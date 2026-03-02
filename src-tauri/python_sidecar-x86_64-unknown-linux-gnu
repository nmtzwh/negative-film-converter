#!/bin/bash
# Wrapper to run the python server from the venv
# In production, this will be the compiled binary
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source "$DIR/../backend/venv/bin/activate"
python "$DIR/../backend/server.py"
