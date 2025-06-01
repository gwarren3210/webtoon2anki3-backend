# Main file for the Anki builder microservice
# Implements a Flask endpoint to generate Anki packages.
# Endpoint in GCR http://anki-builder-530177289872.us-central1.run.app/build-package
# TODO: setup this folder as a subrepo spo its easier to to CI/CD or another method

import json
import random
import genanki
from flask import Flask, request, Response, jsonify

# Define a unique model ID for genanki
# Using a random number to avoid conflicts
ANKI_MODEL_ID = random.randrange(1 << 30, 1 << 31)

# Define the Anki Model (card type)
ANKI_MODEL = genanki.Model(
  ANKI_MODEL_ID,
  'Simple Webtoon Card',
  fields=[
    {'name': 'Original Line'},
    {'name': 'Translated Line'},
    {'name': 'Original Word'},
    {'name': 'Translated Word'},
  ],
  templates=[
    {
      'name': 'Card 1',
      'qfmt': '{{Original Line}}<br><br>{{Original Word}}',
      'afmt': '{{FrontSide}}<hr id="answer">{{Translated Line}}<br><br>{{Translated Word}}',
    },
  ])

def build_anki_package(translated_word_infos):
  """
  Builds an Anki package (.apkg) from a list of translated word information.

  Args:
    translated_word_infos (list): A list of dictionaries, each representing TranslatedWordInfo.

  Returns:
    bytes: The byte content of the generated .apkg file.
  """
  # Define a unique deck ID for genanki
  # Using a random number to avoid conflicts
  anki_deck_id = random.randrange(1 << 30, 1 << 31)
  my_deck = genanki.Deck(
    anki_deck_id,
    'Webtoon Translated Words'
  )

  for info in translated_word_infos:
    my_note = genanki.Note(
      model=ANKI_MODEL,
      fields=[
        info.get('originalLine', ''),
        info.get('translatedLine', ''),
        info.get('originalWord', ''),
        info.get('translatedWord', '')
      ])
    my_deck.add_note(my_note)

  # Create a GenPackage and write to a temporary file to get bytes
  # This is a workaround to get the file content as bytes directly
  output_filename = f"webtoon_anki_{anki_deck_id}.apkg"
  # Using a dummy file path for GenPackage, as we'll read the bytes
  my_deck.write_to_file(output_filename)

  with open(output_filename, 'rb') as f:
      apkg_content = f.read()

  # Clean up the temporary file
  import os
  os.remove(output_filename)

  return apkg_content

app = Flask(__name__)

@app.route('/build-package', methods=['POST'])
def build_package():
  """
  Flask endpoint to receive translated word information and return an Anki package.
  Input: JSON body containing a list of TranslatedWordInfo objects.
  Output: .apkg file as a response.
  """
  if not request.is_json:
    return jsonify({"error": "Request body must be JSON"}), 415

  translated_word_infos = request.get_json()

  if not isinstance(translated_word_infos, list):
      return jsonify({"error": "JSON body must be a list of TranslatedWordInfo"}), 400

  try:
      apkg_bytes = build_anki_package(translated_word_infos)
      response = Response(apkg_bytes, mimetype='application/octet-stream')
      response.headers.set('Content-Disposition', 'attachment', filename='webtoon_anki_package.apkg')
      return response
  except Exception as e:
      app.logger.error(f"Error building Anki package: {e}")
      return jsonify({"error": "Failed to build Anki package", "details": str(e)}), 500

# TODO: add endpoint for uploading directly to anki db

@app.route('/hello-from-gcp', methods=['GET'])
def hello_from_gcp():
    """
    Simple test endpoint to verify GCP deployment.
    Returns a greeting message.
    """
    return jsonify({
        "message": "Hello from GCP!",
        "status": "success"
    })


if __name__ == "__main__":
  # In production, use a WSGI server like Gunicorn
  # For local testing, you can run with app.run(debug=True)
  # However, the Dockerfile uses gunicorn, so this block is mainly for local dev outside docker
  # app.run(debug=True, host='0.0.0.0')
  # When running with gunicorn, the app object is used directly
  pass 