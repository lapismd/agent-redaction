//! Native privacy policies; callers own admission, source acquisition and persistence.
#![forbid(unsafe_code)]
mod hook;
mod scanner;
mod stream_text;
mod transcript;

pub use hook::{KINGFISHER_POLICY, MAX_HOOK_BYTES, SanitizedHookPayload, sanitize_hook_payload};
pub use scanner::{kingfisher_cache_ready, warm_kingfisher_cache};
pub use transcript::{TRANSCRIPT_POLICY, TranscriptSanitizer};

/// A validated immutable JSON result; raw input is never retained in this value.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SanitizedJson(Vec<u8>);
impl SanitizedJson {
    pub fn bytes(&self) -> &[u8] {
        &self.0
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, thiserror::Error)]
pub enum Error {
    #[error("native privacy cache unavailable")]
    Cache,
    #[error("invalid native privacy scope")]
    Scope,
    #[error("native privacy input limit")]
    Limit,
}
pub type Result<T> = std::result::Result<T, Error>;
