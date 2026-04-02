.PHONY: build build-native test install clean doctor

build:
	npx tsc

build-native:
	cd native && cargo build --release

test:
	npx tsc
	npm test

install:
	npm install -g .

clean:
	rm -rf dist native/target

doctor:
	node dist/cli.js doctor
