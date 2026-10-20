use lapis_agent_redaction::{
    KINGFISHER_POLICY, MAX_HOOK_BYTES, SanitizedHookPayload, TRANSCRIPT_POLICY,
    TranscriptSanitizer, kingfisher_cache_ready, sanitize_hook_payload,
};
use serde_json::json;
use std::path::Path;

#[test]
fn native_policy_preserves_canonical_bytes_detector_and_stream_boundaries() {
    let cache = tempfile::tempdir().unwrap();
    let scope = TranscriptSanitizer::new(
        Path::new("/home/example/vault"),
        Path::new("/home/example"),
        Path::new("/tmp/example"),
        cache.path(),
    )
    .unwrap()
    .for_secrets(&["synthetic-secret-value".into()])
    .unwrap();
    assert!(kingfisher_cache_ready(cache.path()));
    assert_eq!(
        KINGFISHER_POLICY,
        "kingfisher-scanner@1.4.0/builtin-medium/v1"
    );
    assert_eq!(
        TRANSCRIPT_POLICY,
        "kingfisher-scanner@1.4.0/builtin-medium/transcript-paths/v1"
    );
    let value = json!({"z": "/home/example/vault/note.md", "a": {"/home/example/private": "synthetic-secret-value"}});
    assert_eq!(
        scope.sanitize(value).unwrap().bytes(),
        br#"{"a":{"$HOME/private":"$SECRET"},"z":"$WORKSPACE/note.md"}"#
    );
    assert!(
        scope
            .sanitize(json!({"/home/example": 1, "$HOME": 2}))
            .is_none()
    );
    let detector_fixture = format!("ghp_{}", "NQLObn7M3OTKBL44TH6K9WxFY39LZM1sDc0K");
    let scanned = scope.sanitize(json!({"token": detector_fixture})).unwrap();
    assert_eq!(scanned.bytes(), br#"{"token":"[REDACTED]"}"#);
    for (raw, expected) in [
        ("🦀 /home/example/vault/note.md", "🦀 $WORKSPACE/note.md"),
        ("/home/example/config", "$HOME/config"),
        ("/tmp/example/file", "$TEMP/file"),
        ("synthetic-secret-value", "$SECRET"),
    ] {
        for (split, _) in raw.char_indices() {
            let mut pending = String::new();
            let mut output = scope
                .replace_stream_text(&mut pending, &raw[..split], false)
                .unwrap();
            output.push_str(
                &scope
                    .replace_stream_text(&mut pending, &raw[split..], false)
                    .unwrap(),
            );
            output.push_str(&scope.replace_stream_text(&mut pending, "", true).unwrap());
            let safe = scope.sanitize(json!({"text": output})).unwrap();
            let parsed: serde_json::Value = serde_json::from_slice(safe.bytes()).unwrap();
            assert_eq!(parsed["text"], expected, "split {split}");
            assert!(pending.is_empty());
        }
    }
    let next = scope.for_workspace(Path::new("/work/new-vault")).unwrap();
    assert_eq!(
        next.sanitize(json!({"v": "/work/new-vault/a"}))
            .unwrap()
            .bytes(),
        br#"{"v":"$WORKSPACE/a"}"#
    );
    assert!(next.for_secrets(&["tiny".into()]).is_err());
    assert!(
        next.replace_stream_text(&mut String::new(), &"x".repeat(512 * 1024 + 1), false)
            .is_err()
    );
    assert!(
        next.sanitize(json!({"large":"x".repeat(1024 * 1024)}))
            .is_none()
    );
}

#[test]
fn malformed_input_and_unavailable_cache_never_return_raw_values() {
    let root = tempfile::tempdir().unwrap();
    let blocked = root.path().join("not-a-directory");
    std::fs::write(&blocked, b"occupied").unwrap();
    for raw in [b"not-json".as_slice(), b"[1]", br#"{"s":"private-value"}"#] {
        assert_eq!(
            sanitize_hook_payload(raw, Path::new("/work/vault"), &blocked),
            SanitizedHookPayload::Omitted
        );
    }
    assert_eq!(
        sanitize_hook_payload(
            &vec![b'x'; MAX_HOOK_BYTES + 1],
            Path::new("/work/vault"),
            &blocked
        ),
        SanitizedHookPayload::Omitted
    );
    let error = TranscriptSanitizer::new(
        Path::new("/work/vault"),
        Path::new("/home/example"),
        Path::new("/tmp/example"),
        &blocked,
    )
    .err()
    .unwrap();
    assert_eq!(error.to_string(), "native privacy cache unavailable");
    assert!(
        TranscriptSanitizer::new(
            Path::new("/"),
            Path::new("/home/example"),
            Path::new("/tmp/example"),
            &blocked
        )
        .is_err()
    );
}
