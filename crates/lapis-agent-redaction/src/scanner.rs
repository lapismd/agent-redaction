use kingfisher_core::Blob;
use kingfisher_rules::{RuleCacheConfig, RulesDatabase, get_builtin_rules};
use kingfisher_scanner::{Scanner, ScannerConfig};
use serde_json::Value;
use std::{fs, path::Path, sync::Arc};
pub fn warm_kingfisher_cache(cache: &Path) -> crate::Result<()> {
    scanner(cache).map(|_| ())
}

pub fn kingfisher_cache_ready(cache: &Path) -> bool {
    let cache = cache.join("kingfisher-scanner-1.4.0");
    fs::symlink_metadata(&cache)
        .is_ok_and(|value| value.is_dir() && !value.file_type().is_symlink())
        && fs::read_dir(&cache).is_ok_and(|entries| {
            entries.filter_map(Result::ok).any(|entry| {
                entry
                    .path()
                    .extension()
                    .is_some_and(|value| value == "vscdb")
                    && entry.file_type().is_ok_and(|value| value.is_file())
            })
        })
}

pub(crate) fn scan_json(value: Value, scanner: &Scanner) -> Option<crate::SanitizedJson> {
    let canonical = serde_json::to_vec(&canonical_json(value)).ok()?;
    if canonical.len() > 4 * 1024 * 1024 {
        return None;
    }
    let blob = Blob::from_bytes(canonical.clone());
    let mut spans = scanner
        .scan_blob_at_path(&blob, "")
        .ok()?
        .into_iter()
        .map(|finding| (finding.location.start_offset, finding.location.end_offset))
        .collect::<Vec<_>>();
    spans.sort_unstable();
    let spans = merge_spans(spans, canonical.len())?;
    let mut sanitized = canonical;
    for (start, end) in spans.into_iter().rev() {
        sanitized.splice(start..end, b"[REDACTED]".iter().copied());
    }
    if serde_json::from_slice::<Value>(&sanitized).is_err() {
        return None;
    }
    if sanitized.len() > 1024 * 1024 {
        return None;
    }
    Some(crate::SanitizedJson(
        serde_json::to_vec(&canonical_json(serde_json::from_slice(&sanitized).ok()?)).ok()?,
    ))
}

pub(crate) fn scanner(cache: &Path) -> crate::Result<Scanner> {
    fs::create_dir_all(cache).map_err(|_| crate::Error::Cache)?;
    restrict_directory(cache).map_err(|_| crate::Error::Cache)?;
    let cache = cache.join("kingfisher-scanner-1.4.0");
    fs::create_dir_all(&cache).map_err(|_| crate::Error::Cache)?;
    restrict_directory(&cache).map_err(|_| crate::Error::Cache)?;
    let rules = get_builtin_rules(None).map_err(|_| crate::Error::Cache)?;
    let database =
        RulesDatabase::from_rule_collection_with_cache(rules, &RuleCacheConfig::new(&cache))
            .map_err(|_| crate::Error::Cache)?;
    let config = ScannerConfig {
        enable_base64_decoding: false,
        enable_dedup: false,
        redact_secrets: true,
        ..ScannerConfig::default()
    };
    Ok(Scanner::with_config(Arc::new(database), config))
}

fn merge_spans(spans: Vec<(usize, usize)>, length: usize) -> Option<Vec<(usize, usize)>> {
    let mut merged: Vec<(usize, usize)> = Vec::new();
    for (start, end) in spans {
        if start >= end || end > length {
            return None;
        }
        if let Some(previous) = merged.last_mut()
            && start <= previous.1
        {
            previous.1 = previous.1.max(end);
        } else {
            merged.push((start, end));
        }
    }
    Some(merged)
}

fn canonical_json(value: Value) -> Value {
    match value {
        Value::Object(values) => {
            let mut entries = values.into_iter().collect::<Vec<_>>();
            entries.sort_unstable_by(|a, b| a.0.cmp(&b.0));
            Value::Object(
                entries
                    .into_iter()
                    .map(|(k, v)| (k, canonical_json(v)))
                    .collect(),
            )
        }
        Value::Array(values) => Value::Array(values.into_iter().map(canonical_json).collect()),
        value => value,
    }
}
fn restrict_directory(path: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt as _;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}
