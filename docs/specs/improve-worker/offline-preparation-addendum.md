# Executable preparation additions for #284

The exact selected resource values also live in
`offline-resource-profile.json`, including tmpfs memory accounting and its
unqualified capacity status. Executable preparation reference checks cover
resource negatives, complete effective mount collisions, all 573 actual target
snapshot entries, each named unsupported dependency form, missing graph edges
and cross-field recipe equality. These pure preparation references do not create
workers or grant implementation acceptance. The supported root range subset is
numeric semver ranges; prerelease/tag/alias forms outside that subset fail
explicitly rather than being interpreted by a different resolver.

The approved host cache bind and every trusted software/input bind are read-only
in both phases. Before invoking the copier or package manager, compare actual
Docker inspection mount modes to the expected immutable bind set; any writable
cache/software/input bind fails `offline_resource_invalid`. Only the declared
private tmpfs locations are writable. This makes the existing I-OFFLINE-004
source-cache read exception explicit without changing its pinned acceptance.
The complete writable/read-only mount inspection remains a runtime obligation;
the preparation validator exercises mode decisions, not Docker execution.
