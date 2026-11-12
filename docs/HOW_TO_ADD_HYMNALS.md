# How to Add Bundled Hymnals

The application bundles official hymnals so users have them available immediately upon first launch, without needing to import them manually.

## 1. Creating the Hymnal Folder
A hymnal is a directory containing the hymnal's metadata, cover image, and individual `.ektp` files (the hymns).

Inside the hymnal directory (e.g., `MyHymnal/`), you need:
- `hymnal.json`: The manifest file describing the hymnal.
- `cover.jpg`: A 2:3 aspect ratio cover image for the hymnal (optional but recommended).
- Individual `.ektp` files for each hymn (these represent the presentation slides for each hymn).

### Example `hymnal.json` structure:
```json
{
  "id": "my-hymnal-id",
  "name": "My Hymnal Name",
  "language": "en",
  "publisher": "My Publisher",
  "year": 2026,
  "description": "A collection of classic hymns.",
  "hymns": [
    {
      "id": "hymn-1",
      "title": "Amazing Grace",
      "number": 1
    }
  ],
  "thematicIndex": [
    {
      "theme": "Worship",
      "hymnIds": ["hymn-1"]
    }
  ]
}
```

## 2. Adding to the App
1. Place the generated hymnal directory in the appropriate language subfolder inside `bundled-hymnals/`:
   - `bundled-hymnals/ru/MyHymnal/` for Russian
   - `bundled-hymnals/en/MyHymnal/` for English
   - `bundled-hymnals/de/MyHymnal/` for German

2. The application's build process (`electron-builder`) will automatically package everything inside `bundled-hymnals/`.

3. On the application's first launch, it will scan `bundled-hymnals/`, read the directories, and recursively copy them to the user's data directory (e.g., `~/.ekklesienter/Hymnals`). 

4. The frontend will parse the hymnals during initialization and extract the `language` field either from the manifest or from the folder name to enforce language separation.
