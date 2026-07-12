# Captions, Transcription, and Transcript-Aware Media

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-12

## Product Conclusion

Transcription is foundational metadata, not only a caption export. A timestamped
transcript can power captions, search, dubbing, text-based editing, speaker
selection, content analysis, and accessibility.

The first TaleLabs feature should create a durable transcript artifact and
optional SRT/VTT Assets. Burned-in captions are a downstream render operation
with a style configuration.

## User Workflows

- generate accurate captions for social and accessibility;
- edit words and timing before export;
- search long media and jump to a spoken phrase;
- identify speakers and reuse segments in dubbing;
- export sidecar SRT/VTT or burn captions into a video;
- reuse one approved caption style;
- edit talking-head media by editing the transcript.

Descript's core interaction deletes or rearranges media through transcript text,
and captions remain linked to the script. Premiere supports text-based sequence
editing and separate caption workflows/exports. These products show why the
transcript should remain structured instead of being reduced to one text blob.

## Domain Contract

```ts
type Transcript = {
  sourceAssetId: string;
  language: string;
  durationMs: number;
  segments: TranscriptSegment[];
};

type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerKey?: string;
  words?: Array<{
    startMs: number;
    endMs: number;
    text: string;
    confidence?: number;
  }>;
};
```

If the product only needs captions at first, this can live in a versioned JSON
artifact plus an indexed summary. Interactive transcript editing later merits
normalized revisions or a dedicated document model.

## Proposed Nodes

```txt
Transcribe Media
  media: VideoSet (1) | AudioSet (1)
  language?: auto | locale
  diarization: boolean
  output: TranscriptSet

Create Captions
  transcript: TranscriptSet (1)
  format: srt | vtt | styled
  style?: CaptionStyleRef
  output: TextAssetSet | VideoSet
```

Transcript output requires a typed collection when approved. A sidecar caption
is stored as a canonical text/document Asset, while a styled burn-in is a new
video Asset.

## Provider Candidates

| Provider family                | Useful capability                       | Concern                                             |
| ------------------------------ | --------------------------------------- | --------------------------------------------------- |
| ElevenLabs Speech to Text      | batch/realtime transcription            | verify language, diarization, timestamps, and price |
| managed cloud STT providers    | mature language and diarization options | provider-specific output normalization              |
| Whisper-family/self-hosted ASR | deployment control                      | GPU/CPU cost and operational quality                |
| Descript/Adobe product UX      | reference for editing and captions      | application capability is not necessarily an API    |

## Implementation Notes

- Store raw provider output for audit/debugging and a normalized TaleLabs
  transcript version for product use.
- Snapshot the source Asset and transcription settings.
- Use Trigger.dev for batch transcription; realtime is a separate product path.
- Apply edits as transcript revisions; never mutate historical run provenance.
- Keep caption line breaking and style separate from words/timestamps.
- Validate reading speed, characters per line, minimum duration, and gaps.
- Export SRT/VTT with a deterministic renderer and encode text correctly.
- Retain source locale and translated-caption locale separately.

## UX and Evaluation

The transcript viewer should synchronize selection and playback. Users need to
correct text, merge/split segments, change speaker, and regenerate captions
without retranscribing the source.

Evaluate names, punctuation, numbers, music/noise, accents, overlapping speech,
speaker diarization, timing drift, line breaks, and long-duration media.

## Sources

### Primary

- [ElevenLabs API capability overview](https://elevenlabs.io/api)
- [Descript edit-like-a-document workflow](https://help.descript.com/hc/en-us/articles/15726742913933-Edit-like-a-doc)
- [Descript captions and reusable styles](https://help.descript.com/hc/en-us/articles/37469585005197-Add-and-style-captions)
- [Adobe Premiere text-based editing](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/overview-of-text-based-editing.html)
- [Adobe Premiere caption creation](https://helpx.adobe.com/ae_en/premiere/desktop/add-text-images/insert-captions/create-captions.html)
- [Adobe Premiere caption export](https://helpx.adobe.com/ca/premiere/desktop/render-and-export/export-files/export-caption-tracks.html)

### Community Signals

- [Captioning and short-form repurposing workflows](https://www.reddit.com/r/contentcreation/comments/1rkltot/has_ai_video_worked_into_anyones_regular_content/)
- [Fragmented scripting, captions, editing, and export](https://www.reddit.com/r/ContentCreators/comments/1unx9rk/is_there_an_all_in_one_ai_video_tool_in_2026/)
