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
      "https://your-frontend-domain.com" // Your production frontend
    ],
    "allow_headers": ["*"],
    "expose_headers": ["*"],
    "debug": true
  }
}