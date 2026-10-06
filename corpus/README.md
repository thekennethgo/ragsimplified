# Starter corpus

Files here are loaded by `make seed` and copied to `frontend/public/corpus/`. To add a document, follow [docs/ADDING_DOCUMENTS.md](../docs/ADDING_DOCUMENTS.md).

The Wikipedia articles below are **placeholders for testing**, saved as Markdown with their source URL and revision at the top. They are available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); keep the attribution line in each file.

| File | Source |
|---|---|
| `retrieval-augmented-generation.md` | https://en.wikipedia.org/wiki/Retrieval-augmented_generation |
| `information-retrieval.md` | https://en.wikipedia.org/wiki/Information_retrieval |
| `apple-inc.md` | https://en.wikipedia.org/wiki/Apple_Inc. |
| `iphone.md` | https://en.wikipedia.org/wiki/IPhone |
| `macbook-pro.md` | https://en.wikipedia.org/wiki/MacBook_Pro |
| `apple-silicon.md` | https://en.wikipedia.org/wiki/Apple_silicon |

Added in step 3.8 to make retrieval harder: documents that compete with the first six, a PDF, and two fictional-universe topics.

| File | Source |
|---|---|
| `android.pdf` | https://en.wikipedia.org/wiki/Android_(operating_system), rendered to a 27-page PDF (so page numbers and the PDF path are tested) |
| `samsung-galaxy.md` | https://en.wikipedia.org/wiki/Samsung_Galaxy |
| `microsoft.md` | https://en.wikipedia.org/wiki/Microsoft |
| `large-language-model.md` | https://en.wikipedia.org/wiki/Large_language_model |
| `vector-database.md` | https://en.wikipedia.org/wiki/Vector_database |
| `search-engine.md` | https://en.wikipedia.org/wiki/Search_engine |
| `star-wars.md` | https://en.wikipedia.org/wiki/Star_Wars |
| `star-wars-film.md` | https://en.wikipedia.org/wiki/Star_Wars_(film) |
| `the-empire-strikes-back.md` | https://en.wikipedia.org/wiki/The_Empire_Strikes_Back |
| `cyberpunk-2077.md` | https://en.wikipedia.org/wiki/Cyberpunk_2077 |
| `cyberpunk.md` | https://en.wikipedia.org/wiki/Cyberpunk |

These are Wikipedia's articles about the franchises (CC BY-SA 4.0), not the franchises' own text.

The owner's own documents (CV, experience, projects, public contact details) are added late in the project.
