# Advisory review #298

Purpose: advisory; Gate C decision: pending.
Execution: completed; scope at execution: current; mode: live; invoked: true.
Attempt: 8abc8345-523b-4273-af95-77496eb6619f
Input snapshot: 0ccc6b89bcc02ec4f90f5187a0fced1f022f4c99163a1e1530f638d51c6ae94c
Diff: cc832992104073046925215115ddb4c5811151114bcd6faddb167e2624721d2c
Base: 836f7cc04e8889010d31696c35e3cb49573649f0
Reviewer: codex-sol-reviewer; requested: gpt-5.6-sol; served: unknown

- **p1 ADV-298-001** scripts/specflow-improve.cjs:809: Verifier identity omits the runtime files that define the selected backend profile.
  Disposition: reported fixed; tracking issue #298. The verifier identity now includes the worker implementation, profile registry, and journey-profile configuration. The core regression mutates each identity-sensitive input during verification and requires rejection without a receipt. The frozen identity delta records the worker entry as the sole post-qualification runtime change and a successful 158-test focused run.
  Evidence: scripts/specflow-improve.cjs sha256:7d9a62039c0bbb9ae84becd253c08ae2aed0433a760244ea048ed1f56b8398a5
  Evidence: scripts/improve-worker.cjs sha256:af978580aceddc767896ce0a6e107c229981b711e8e47b8e90963e2d48228dab
  Evidence: scripts/improve-backend-profiles.cjs sha256:96040d2123b7db4c1895dedd682908c45905f7da047badd0f5296cd423bae2e5
  Evidence: scripts/improve-backend-journeys-profile.json sha256:d97baabca70c61f2f6b9f00d537d73aa22e2e54cc5026b4e8ba2088b751bc739
  Evidence: tests/contracts/improve-core.test.js sha256:0b9b42f218ebad248b51f840d70b56ea71c94d7097c76f92e53bbcfe9bbc9087
  Evidence: evidence/backend-profile-298/identity-delta.json sha256:df3dda36b031319097bd82513503a3dfaf680b741ca96d7ef475ac8de87c73e4
- **p1 ADV-298-002** tests/qualification/improve-backend-journeys.test.cjs:61: Qualification writes and prints a passed result before validating its terminal state.
  Disposition: reported fixed; tracking issue #298. The qualification driver now awaits settlement and terminal validation before persisting or printing the result. Contract coverage exercises a late cleanup failure and verifies that no passing result is emitted.
  Evidence: tests/qualification/improve-backend-journeys.test.cjs sha256:e6af6276b523587612e5dd94d4738db33bc94d534ea92f093a1a170c9fa9c93f
  Evidence: tests/qualification/backend-journey-result.cjs sha256:d8dc6b5f519ddec451eb366171250e8bc182f6e1542c39fa372f9abb48e82278
  Evidence: tests/contracts/improve-backend-qualification.test.js sha256:cd872467b3f82ec20c47db5311517916f4a6386101cfb213053281ab403b6d3b
- **p1 ADV-298-003** tests/qualification/improve-backend-journeys.test.cjs:57: Qualification overwrites or drops the original failure and cleanup evidence.
  Disposition: reported fixed; tracking issue #298. Settlement now preserves observed, cleanup, and terminal causes separately. Contract tests cover both a journey failure followed by cleanup and a cleanup exception, retaining the original and cleanup evidence instead of overwriting either.
  Evidence: tests/qualification/improve-backend-journeys.test.cjs sha256:e6af6276b523587612e5dd94d4738db33bc94d534ea92f093a1a170c9fa9c93f
  Evidence: tests/qualification/backend-journey-result.cjs sha256:d8dc6b5f519ddec451eb366171250e8bc182f6e1542c39fa372f9abb48e82278
  Evidence: tests/contracts/improve-backend-qualification.test.js sha256:cd872467b3f82ec20c47db5311517916f4a6386101cfb213053281ab403b6d3b
- **p1 ADV-298-004** tests/qualification/improve-backend-journeys.test.cjs:29: The qualification evidence does not retain an exact shutdown duration.
  Disposition: reported fixed; tracking issue #298. The result helper measures the interval directly around backend closure and the driver persists it as shutdownMilliseconds. Contract coverage asserts an exact synthetic duration, while the frozen proof retains measured native shutdown durations for both profiles.
  Evidence: tests/qualification/improve-backend-journeys.test.cjs sha256:e6af6276b523587612e5dd94d4738db33bc94d534ea92f093a1a170c9fa9c93f
  Evidence: tests/qualification/backend-journey-result.cjs sha256:d8dc6b5f519ddec451eb366171250e8bc182f6e1542c39fa372f9abb48e82278
  Evidence: tests/contracts/improve-backend-qualification.test.js sha256:cd872467b3f82ec20c47db5311517916f4a6386101cfb213053281ab403b6d3b
  Evidence: evidence/backend-profile-298/proof.json sha256:b5008b25cb5e4c40d8374594a40a19b0180586c1fcae39268c3f64eed3b71f88
- **p1 ADV-298-005** docs/contracts/journey_confined_backend.yml:6: The required real journey qualification has no successful frozen execution evidence.
  Disposition: reported fixed; tracking issue #298. The frozen journey contract records a passing native qualification. The proof binds the workload source manifest and seven native reports, covering eight baseline cases and six candidate cases with zero failures, skips, or flaky results, plus cleanup, credential removal, and controller-loss assertions.
  Evidence: docs/contracts/journey_confined_backend.yml sha256:c1747ae9c2930da699167743d1613f0fc55970402caa1f0b65690263f644d35c
  Evidence: evidence/backend-profile-298/RESULTS.md sha256:83d386890b81f34f9d022f7e86c61656113e8bb3d356fdf438d2c8c92f73a6df
  Evidence: evidence/backend-profile-298/proof.json sha256:b5008b25cb5e4c40d8374594a40a19b0180586c1fcae39268c3f64eed3b71f88
  Evidence: evidence/backend-profile-298/runtime-source-manifest.json sha256:eb560543ac56eafb9f7cd7068a92ed3603e2f43d1612716c401c1a9c82b08d18
  Evidence: evidence/backend-profile-298/baseline/native-0.json sha256:249c944fad173b547b102453bdaa4323b46bf4c899a0e5be084a6d2626c40725
  Evidence: evidence/backend-profile-298/baseline/native-1.json sha256:144a6223abc6f8e9824cc500994cf54aac637ff9020b8961a3f2afbddef71917
  Evidence: evidence/backend-profile-298/baseline/native-2.json sha256:e497ddebef8802c87cf5a1501c2f74777355fd287a1ebef9a7d03fa7a976a18d
  Evidence: evidence/backend-profile-298/baseline/native-3.json sha256:9564e5582de00887559f762c2b088981db354ef3a00bcfe1a6b40edc032c961c
  Evidence: evidence/backend-profile-298/after/native-0.json sha256:a25e346837b86e52d704ca29430435dee70a8fcc2183167f666b0f296f1b1add
  Evidence: evidence/backend-profile-298/after/native-1.json sha256:14be26382dc9e24921f509b91aef2e0f7a9acff4cb031095930cb02fa88db571
  Evidence: evidence/backend-profile-298/after/native-2.json sha256:f3b7e583964420cbe28107d0abecab8dcda65270263499930484d5f7afea7f79
  Evidence: evidence/backend-profile-298/ci-2f8.json sha256:daad1c115185fa3b8414ce246de10bb84730381d6731fc098b0b8af870fa9a07
- **p1 ADV-298-006** scripts/improve-backend-generation.cjs:86: The legacy profile bypasses inventory and remaining-horizon admission.
  Disposition: reported fixed; tracking issue #298. Generation now performs phase planning before beginning an attempt for every profile and repeats admission after the build before application creation. Regression coverage verifies that the legacy profile is rejected before attempt or credential allocation when inventory or remaining horizon is insufficient, including build-time horizon depletion.
  Evidence: scripts/improve-backend-generation.cjs sha256:e260614e47af416a6949799c047f2164ad4dc68103dcb7ba5e19b858af4d60e7
  Evidence: scripts/improve-backend-profiles.cjs sha256:96040d2123b7db4c1895dedd682908c45905f7da047badd0f5296cd423bae2e5
  Evidence: tests/contracts/improve-backend-generation.test.js sha256:dff3ffd76329c09eb797aeefbde20432f6d66157a7066cdd8ae8c1c80ac20153
  Evidence: tests/contracts/improve-backend-profile.test.js sha256:d96f9211612e2487731256aa93dfff7d2efe734b14412bb0d8756d1fc8233d30
  Evidence: evidence/backend-profile-298/ci-2f8.json sha256:daad1c115185fa3b8414ce246de10bb84730381d6731fc098b0b8af870fa9a07

This report is a projection; canonical attempts and the current handoff retain findings and freshness. It grants no preparation, Duo or merge approval.
