.PHONY: build test install clean doctor lint

build:
	cargo build --release

test:
	cargo test
	npm test

install:
	cargo install --path .

clean:
	cargo clean

doctor:
	./target/release/specflow doctor

lint:
	cargo clippy -- -D warnings

fmt:
	cargo fmt

check:
	cargo check
