use crate::scanner::{scan_json, scanner};
use serde_json::Value;
use std::path::Path;
pub const MAX_HOOK_BYTES: usize = 4 * 1024 * 1024;
pub const KINGFISHER_POLICY: &str = "kingfisher-scanner@1.4.0/builtin-medium/v1";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SanitizedHookPayload {
    Sanitized {
        payload: crate::SanitizedJson,
        policy: &'static str,
    },
    Omitted,
}

pub fn sanitize_hook_payload(raw: &[u8], workspace: &Path, cache: &Path) -> SanitizedHookPayload {
    sanitize(raw, workspace, cache).unwrap_or(SanitizedHookPayload::Omitted)
}

fn sanitize(raw: &[u8], workspace: &Path, cache: &Path) -> Option<SanitizedHookPayload> {
    if raw.len() > MAX_HOOK_BYTES {
        return None;
    }
    let mut value: Value = match serde_json::from_slice(raw) {
        Ok(Value::Object(value)) => Value::Object(value),
        _ => return None,
    };
    let workspace = workspace.to_str()?;
    normalize_workspace_paths(&mut value, workspace);
    Some(SanitizedHookPayload::Sanitized {
        payload: scan_json(value, &scanner(cache).ok()?)?,
        policy: KINGFISHER_POLICY,
    })
}

fn normalize_workspace_paths(value: &mut Value, workspace: &str) {
    match value {
        Value::String(text) => {
            if text.contains(workspace) {
                *text = text.replace(workspace, "$WORKSPACE");
            }
        }
        Value::Array(values) => {
            for value in values {
                normalize_workspace_paths(value, workspace);
            }
        }
        Value::Object(values) => {
            for value in values.values_mut() {
                normalize_workspace_paths(value, workspace);
            }
        }
        _ => {}
    }
}
