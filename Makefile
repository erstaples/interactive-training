.PHONY: serve

PORT ?= 8080

serve:
	python3 -m http.server $(PORT)
