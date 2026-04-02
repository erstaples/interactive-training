.PHONY: serve validate

PORT ?= 8080

serve:
	python3 -m http.server $(PORT)

validate:
	@for f in courses/*.json; do \
		python3 -c "import json, sys; json.load(open('$$f')); print('OK: ' + '$$f')" || exit 1; \
	done
