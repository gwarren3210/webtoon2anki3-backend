# Main file for the Anki builder microservice
# Implements a Flask endpoint to generate Anki packages.
# Endpoint in GCR http://anki-builder-530177289872.us-central1.run.app/build-package

import json
import random
import genanki
from flask import Flask, request, Response, jsonify

# Define a unique model ID for genanki
# Using a random number to avoid conflicts
ANKI_MODEL_ID = random.randrange(1 << 30, 1 << 31)

def create_anki_model(config):
  """
  Creates an Anki model with templates based on the provided configuration.

  Args:
    config (dict): Configuration for card generation containing:
      - front_fields (list): Fields to show on front of card
      - back_fields (list): Fields to show on back of card
      - create_duplicate (bool): Whether to create a duplicate card with swapped front/back

  Returns:
    genanki.Model: The configured Anki model
  """
  # Define the fields
  fields = [
    {'name': 'Original Line'},
    {'name': 'Translated Line'},
    {'name': 'Original Word'},
    {'name': 'Translated Word'},
  ]

  # Create templates based on configuration
  templates = []
  
  # Create front template
  front_template = {
    'name': 'Card 1',
    'qfmt': '<br><br>'.join(f'{{{{{field}}}}}' for field in config['front_fields']),
    'afmt': '{{FrontSide}}<hr id="answer">' + '<br><br>'.join(f'{{{{{field}}}}}' for field in config['back_fields'])
  }
  templates.append(front_template)

  # Create reversed template if requested
  if config['create_duplicate']:
    back_template = {
      'name': 'Card 2',
      'qfmt': '<br><br>'.join(f'{{{{{field}}}}}' for field in config['back_fields']),
      'afmt': '{{FrontSide}}<hr id="answer">' + '<br><br>'.join(f'{{{{{field}}}}}' for field in config['front_fields'])
    }
    templates.append(back_template)

  return genanki.Model(
    ANKI_MODEL_ID,
    'Simple Webtoon Card',
    fields=fields,
    templates=templates
  )

def build_anki_package(translated_word_infos, config=None):
  """
  Builds an Anki package (.apkg) from a list of translated word information.

  Args:
    translated_word_infos (list): A list of dictionaries, each representing TranslatedWordInfo.
    config (dict, optional): Configuration for card generation. Can include:
      - front_fields (list): Fields to show on front of card
      - back_fields (list): Fields to show on back of card
      - create_duplicate (bool): Whether to create a duplicate card with swapped front/back

  Returns:
    bytes: The byte content of the generated .apkg file.
  """
  # Default configuration
  default_config = {
    'front_fields': ['Original Line', 'Original Word'],
    'back_fields': ['Translated Line', 'Translated Word'],
    'create_duplicate': False
  }
  
  # Merge provided config with defaults
  if config:
    default_config.update(config)
  config = default_config

  # Create the model with the current configuration
  anki_model = create_anki_model(config)

  # Define a unique deck ID for genanki
  anki_deck_id = random.randrange(1 << 30, 1 << 31)
  my_deck = genanki.Deck(
    anki_deck_id,
    'Webtoon Translated Words'
  )

  for info in translated_word_infos:
    # Create the note with all fields
    my_note = genanki.Note(
      model=anki_model,
      fields=[
        info.get('originalLine', ''),
        info.get('translatedLine', ''),
        info.get('originalWord', ''),
        info.get('translatedWord', '')
      ])
    my_deck.add_note(my_note)

  # Create a GenPackage and write to a temporary file to get bytes
  output_filename = f"webtoon_anki_{anki_deck_id}.apkg"
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
  Input: JSON body containing:
    - translated_word_infos: list of TranslatedWordInfo objects
    - config (optional): Configuration for card generation
  Output: .apkg file as a response.
  """
  if not request.is_json:
    return jsonify({"error": "Request body must be JSON"}), 415

  data = request.get_json()
  translated_word_infos = data.get('translated_word_infos', [])
  config = data.get('config', {})

  if not isinstance(translated_word_infos, list):
      return jsonify({"error": "translated_word_infos must be a list of TranslatedWordInfo"}), 400

  try:
      apkg_bytes = build_anki_package(translated_word_infos, config)
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