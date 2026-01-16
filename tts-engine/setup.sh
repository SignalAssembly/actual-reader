#!/bin/bash
# Setup TTS engine for Actual Reader
set -e

cd "$(dirname "$0")"

echo "Creating virtual environment..."
python3 -m venv .venv

echo "Activating..."
source .venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Done. Run with: .venv/bin/python bridge.py"
