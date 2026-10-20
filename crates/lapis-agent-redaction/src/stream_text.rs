use crate::Result;
use crate::TranscriptSanitizer;

impl TranscriptSanitizer {
    /// Apply exact privacy replacements across arbitrary UTF-8 chunks. The caller
    /// must still scan emitted text with `sanitize` before publication. Pending
    /// text is memory-only and must be flushed at each logical message boundary.
    pub fn replace_stream_text(
        &self,
        pending: &mut String,
        chunk: &str,
        complete: bool,
    ) -> Result<String> {
        if pending.len().saturating_add(chunk.len()) > 512 * 1024 {
            return Err(crate::Error::Limit);
        }
        pending.push_str(chunk);
        let mut result = String::new();
        let mut offset = 0;
        while offset < pending.len() {
            let remaining = &pending[offset..];
            // Prefer a possible longer root over a full shorter root, e.g.
            // `$HOME` when `$WORKSPACE` is below it. Never emit that prefix.
            if !complete
                && self
                    .replacements
                    .iter()
                    .any(|(path, _)| path.len() > remaining.len() && path.starts_with(remaining))
            {
                break;
            }
            if let Some((path, tag)) = self
                .replacements
                .iter()
                .find(|(path, _)| remaining.starts_with(path))
            {
                result.push_str(tag);
                offset += path.len();
            } else {
                let character = remaining.chars().next().ok_or(crate::Error::Scope)?;
                result.push(character);
                offset += character.len_utf8();
            }
        }
        pending.drain(..offset);
        Ok(result)
    }
}
