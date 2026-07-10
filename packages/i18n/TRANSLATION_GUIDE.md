# TaleLabs localization guide

Translate the user’s intent, not the English words in isolation. Internal code
may continue to use domain terms such as `Asset` and `slug`; UI copy should use
the term that tells a person what they will see or do.

## Product terminology

| Locale | Assets navigation | Elements | Flows | Workspace URL |
| --- | --- | --- | --- | --- |
| `en` | Assets | Elements | Flows | Workspace URL |
| `pt-BR` | Arquivos | Elementos | Fluxos | URL do workspace |
| `pt-PT` | Ficheiros | Elementos | Fluxos | Endereço do espaço de trabalho |
| `es` | Archivos | Elementos | Flujos | URL del espacio de trabajo |
| `fr` | Fichiers | Éléments | Flux | Adresse de l’espace de travail |
| `de` | Dateien | Elemente | Workflows | Workspace-URL |
| `it` | File | Elementi | Flussi | URL dell’area di lavoro |
| `nl` | Bestanden | Elementen | Workflows | Werkruimte-URL |
| `pl` | Pliki | Elementy | Przepływy pracy | Adres URL obszaru roboczego |
| `ro` | Fișiere | Elemente | Fluxuri de lucru | Adresa spațiului de lucru |

“Assets” means the user’s image, video, and audio files. Therefore, localized
navigation uses the natural word for “files,” even though the API entity remains
`Asset`.

## Voice and conventions

- Keep `TaleLabs` unchanged in every language.
- Keep technical standards such as URL and e-mail recognizable, but avoid
  developer jargon such as “slug” in user-facing copy.
- Use Brazilian Portuguese for `pt-BR` and European Portuguese for `pt-PT`;
  do not reuse one catalog for both.
- Keep “workspace” in Brazilian Portuguese product copy; it is a familiar SaaS
  term and clearer than repeatedly using “espaço de trabalho.”
- Use an informal, direct product voice in German, Spanish, Italian, and Dutch.
- Use a consistent polite plural voice in Romanian.
- Translate progress states as states in progress, not as first-person actions.
- Prefer short action labels and explain technical consequences in descriptions.
- Machine translation may provide a draft, but terminology and final phrasing
  require a contextual review before merging.

## Reference terminology

The terminology choices for creative files are informed by current localized
creative-software usage:

- [Adobe Creative Cloud — Brazilian Portuguese](https://helpx.adobe.com/br/creative-cloud/apps/create-and-manage-libraries/organize-manage-creative-cloud-assets.html)
- [Adobe Creative Cloud — German](https://helpx.adobe.com/de/creative-cloud/apps/create-and-manage-libraries/organize-manage-creative-cloud-assets.html)
- [Adobe Creative Cloud — Italian](https://helpx.adobe.com/it/creative-cloud/apps/create-and-manage-libraries/organize-manage-creative-cloud-assets.html)
- [Adobe Creative Cloud — Dutch](https://helpx.adobe.com/nl/creative-cloud/apps/create-and-manage-libraries/organize-manage-creative-cloud-assets.html)
- [Adobe Creative Cloud — Polish](https://helpx.adobe.com/pl/creative-cloud/apps/create-and-manage-libraries/organize-manage-creative-cloud-assets.html)
