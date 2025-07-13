{
  "id": "backend-dnz2",
  "lang": "typescript",
  "resources": {
    "databases": [
      {
        "name": "mal-service",
        "type": "postgres"
      }
    ]
  },
  "global_cors": {
    "allow_origins_with_credentials": [
      "http://localhost:8080",   // Vite dev server
      "https://localhost:8080",   // Vite dev server
      "https://manhwa-study-cards-48.lovable.app",
      "https://webtoon-flashcard-learn-17.lovable.app"
    ],
    "allow_headers": ["*"],
    "expose_headers": ["*"],
    "debug": true
  }
}