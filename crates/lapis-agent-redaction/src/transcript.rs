use kingfisher_scanner::Scanner;
use serde_json::Value;
use std::path::Path;
pub const TRANSCRIPT_POLICY: &str = "kingfisher-scanner@1.4.0/builtin-medium/transcript-paths/v1";
#[derive(Clone)]
pub struct TranscriptSanitizer {
    scanner: std::sync::Arc<Scanner>,
    pub(crate) replacements: Vec<(String, &'static str)>,
}
impl TranscriptSanitizer {
    pub fn new(
        workspace: &Path,
        home: &Path,
        temporary: &Path,
        cache: &Path,
    ) -> crate::Result<Self> {
        let mut replacements = Vec::new();
        for (path, tag) in [
            (workspace, "$WORKSPACE"),
            (home, "$HOME"),
            (temporary, "$TEMP"),
        ] {
            let text = path.to_str().ok_or(crate::Error::Scope)?;
            if !path.is_absolute()
                || path.parent().is_none()
                || text.contains('\0')
                || path.components().any(|v| {
                    matches!(
                        v,
                        std::path::Component::ParentDir | std::path::Component::CurDir
                    )
                })
            {
                return Err(crate::Error::Scope);
            }
            let text = text.trim_end_matches('/');
            if replacements.iter().any(|(old, _)| old == text) {
                return Err(crate::Error::Scope);
            }
            replacements.push((text.to_owned(), tag));
        }
        replacements.sort_by_key(|(path, _)| std::cmp::Reverse(path.len()));
        Ok(Self {
            scanner: std::sync::Arc::new(crate::scanner::scanner(cache)?),
            replacements,
        })
    }
    /// Rebind only path privacy while reusing the immutable compiled scanner.
    pub fn for_workspace(&self, workspace: &Path) -> crate::Result<Self> {
        let text = workspace.to_str().ok_or(crate::Error::Scope)?;
        if !workspace.is_absolute()
            || workspace.parent().is_none()
            || text.contains('\0')
            || workspace.components().any(|p| {
                matches!(
                    p,
                    std::path::Component::ParentDir | std::path::Component::CurDir
                )
            })
        {
            return Err(crate::Error::Scope);
        }
        let mut replacements: Vec<_> = self
            .replacements
            .iter()
            .filter(|(_, tag)| *tag != "$WORKSPACE")
            .cloned()
            .collect();
        let text = text.trim_end_matches('/');
        if replacements.iter().any(|(path, _)| path == text) {
            return Err(crate::Error::Scope);
        }
        replacements.push((text.to_owned(), "$WORKSPACE"));
        replacements.sort_by_key(|(p, _)| std::cmp::Reverse(p.len()));
        Ok(Self {
            scanner: self.scanner.clone(),
            replacements,
        })
    }
    /// Add exact device-resolved credentials before any journal/publication capture.
    pub fn for_secrets(&self, secrets: &[String]) -> crate::Result<Self> {
        self.with_secret_limit(secrets, 4096)
    }
    /// Bounded OAuth JWTs can exceed ordinary environment-secret limits.
    pub fn for_oauth_secrets(&self, secrets: &[String]) -> crate::Result<Self> {
        self.with_secret_limit(secrets, 16384)
    }
    fn with_secret_limit(&self, secrets: &[String], limit: usize) -> crate::Result<Self> {
        let mut result = self.clone();
        for secret in secrets {
            if secret.len() < 8 || secret.len() > limit {
                return Err(crate::Error::Scope);
            }
            if !result.replacements.iter().any(|(old, _)| old == secret) {
                result.replacements.push((secret.clone(), "$SECRET"));
            }
        }
        if result.replacements.len() > 4096 {
            return Err(crate::Error::Scope);
        }
        result
            .replacements
            .sort_by_key(|(value, _)| std::cmp::Reverse(value.len()));
        Ok(result)
    }
    pub fn sanitize(&self, mut value: Value) -> Option<crate::SanitizedJson> {
        scrub(&mut value, &self.replacements)?;
        crate::scanner::scan_json(value, &self.scanner)
    }
}
fn scrub(value: &mut Value, replacements: &[(String, &'static str)]) -> Option<()> {
    match value {
        Value::String(text) => {
            for (path, tag) in replacements {
                if text.contains(path) {
                    *text = text.replace(path, tag);
                }
            }
        }
        Value::Array(values) => {
            for v in values {
                scrub(v, replacements)?;
            }
        }
        Value::Object(values) => {
            let mut replacement = serde_json::Map::new();
            for (mut key, mut value) in std::mem::take(values) {
                for (path, tag) in replacements {
                    if key.contains(path) {
                        key = key.replace(path, tag);
                    }
                }
                scrub(&mut value, replacements)?;
                if replacement.insert(key, value).is_some() {
                    return None;
                }
            }
            *values = replacement;
        }
        _ => {}
    }
    Some(())
}
