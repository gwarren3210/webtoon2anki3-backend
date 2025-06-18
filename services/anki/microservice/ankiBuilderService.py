# Main file for the Anki builder microservice
# Implements a Flask endpoint to generate Anki packages.
# Endpoint in GCR http://anki-builder-530177289872.us-central1.run.app/build-package

import json
import random
import genanki
import logging
import traceback
from flask import Flask, request, Response, jsonify

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
  try:
    # Define the fields - only English and Korean
    fields = [
      {'name': 'English'},
      {'name': 'Korean'},
    ]

    # Create templates based on configuration
    templates = []
    
    # Create front template
    front_template = {
      'name': 'Card 1',
      'qfmt': (
        '<div style="text-align: center; display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 24px;">' +
        '<br><br>'.join(f'{{{{{field}}}}}' for field in config['front_fields']) +
        '</div>'
      ),
      'afmt': (
        '<div style="text-align: center; display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 24px;">' +
        '{{FrontSide}}<hr id="answer">' +
        '<br><br>'.join(f'{{{{{field}}}}}' for field in config['back_fields']) +
        '</div>'
      )
    }
    templates.append(front_template)

    # Create reversed template if requested
    if config['create_duplicate']:
      back_template = {
        'name': 'Card 2',
        'qfmt': (
          '<div style="text-align: center; display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 24px;">' +
          '<br><br>'.join(f'{{{{{field}}}}}' for field in config['back_fields']) +
          '</div>'
        ),
        'afmt': (
          '<div style="text-align: center; display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 24px;">' +
          '{{FrontSide}}<hr id="answer">' +
          '<br><br>'.join(f'{{{{{field}}}}}' for field in config['front_fields']) +
          '</div>'
        )
      }
      templates.append(back_template)

    return genanki.Model(
      ANKI_MODEL_ID,
      'Simple Webtoon Card',
      fields=fields,
      templates=templates
    )
  except Exception as e:
    logger.error(f"Error creating Anki model: {str(e)}")
    logger.error(traceback.format_exc())
    raise

def build_anki_package(translated_word_infos, deck_name, config=None):
  """
  Builds an Anki package (.apkg) from a list of translated word information.

  Args:
    translated_word_infos (list): A list of dictionaries, each containing 'english' and 'korean' fields.
    deck_name (str): Name of the Anki deck to create.
    config (dict, optional): Configuration for card generation. Can include:
      - front_fields (list): Fields to show on front of card
      - back_fields (list): Fields to show on back of card
      - create_duplicate (bool): Whether to create a duplicate card with swapped front/back

  Returns:
    bytes: The byte content of the generated .apkg file.
  """
  try:
    # Default configuration
    default_config = {
      'front_fields': ['Korean'],
      'back_fields': ['English'],
      'create_duplicate': False
    }
    
    # Merge provided config with defaults
    if config:
      default_config.update(config)
    config = default_config

    logger.info(f"Building Anki package with {len(translated_word_infos)} cards")
    logger.info(f"Configuration: {config}")

    # Create the model with the current configuration
    anki_model = create_anki_model(config)

    # Define a unique deck ID for genanki
    anki_deck_id = random.randrange(1 << 30, 1 << 31)
    my_deck = genanki.Deck(
      anki_deck_id,
      deck_name
    )

    for info in translated_word_infos:
      try:
        # Create the note with English and Korean fields
        my_note = genanki.Note(
          model=anki_model,
          fields=[
            info.get('english', ''),
            info.get('korean', '')
          ])
        my_deck.add_note(my_note)
      except Exception as e:
        logger.error(f"Error adding note: {str(e)}")
        logger.error(f"Note data: {info}")
        raise

    # Create a GenPackage and write to a temporary file to get bytes
    output_filename = f"webtoon_anki_{anki_deck_id}.apkg"
    logger.info(f"Writing package to {output_filename}")
    
    my_deck.write_to_file(output_filename)

    with open(output_filename, 'rb') as f:
        apkg_content = f.read()

    # Clean up the temporary file
    import os
    os.remove(output_filename)
    logger.info("Successfully created and cleaned up Anki package")

    return apkg_content
  except Exception as e:
    logger.error(f"Error building Anki package: {str(e)}")
    logger.error(traceback.format_exc())
    raise

app = Flask(__name__)

@app.route('/build-package', methods=['POST'])
def build_package():
  """
  Flask endpoint to receive translated word information and return an Anki package.
  Input: JSON body containing:
    - translated_word_infos: list of objects with 'english' and 'korean' fields
    - deck_name: name for the Anki deck
    - config (optional): Configuration for card generation
  Output: .apkg file as a response.
  """
  try:
    if not request.is_json:
      return jsonify({"error": "Request body must be JSON"}), 415

    data = request.get_json()
    logger.info(f"Received request with data: {json.dumps(data, indent=2)}")
    
    translated_word_infos = data.get('translated_word_infos', [])
    deck_name = data.get('deck_name')
    config = data.get('config', {})

    if not isinstance(translated_word_infos, list):
        return jsonify({"error": "translated_word_infos must be a list"}), 400
    
    if not deck_name:
        return jsonify({"error": "deck_name is required"}), 400

    # Validate that each word info has both english and korean fields
    for info in translated_word_infos:
        if not isinstance(info, dict) or 'english' not in info or 'korean' not in info:
            return jsonify({
                "error": "Each word info must contain 'english' and 'korean' fields",
                "invalid_item": info
            }), 400

    try:
        apkg_bytes = build_anki_package(translated_word_infos, deck_name, config)
        response = Response(apkg_bytes, mimetype='application/octet-stream')
        response.headers.set('Content-Disposition', 'attachment', filename=f'{deck_name}.apkg')
        return response
    except Exception as e:
        logger.error(f"Error building Anki package: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            "error": "Failed to build Anki package",
            "details": str(e),
            "traceback": traceback.format_exc()
        }), 500
  except Exception as e:
    logger.error(f"Unexpected error in build_package endpoint: {str(e)}")
    logger.error(traceback.format_exc())
    return jsonify({
        "error": "Unexpected error",
        "details": str(e),
        "traceback": traceback.format_exc()
    }), 500

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