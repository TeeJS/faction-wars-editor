extends SceneTree
## Scratch-copy only: imports each --zip= with the game's own importer, then loads
## the installed pack from user://packs the way the pack picker does.
const PackImport := preload("res://src/ui/pack_import.gd")

func _init() -> void:
	var failed := 0
	print("[import_check] user dir: ", OS.get_user_data_dir())
	for a in OS.get_cmdline_user_args():
		if not a.begins_with("--zip="):
			continue
		var r: Dictionary = PackImport.ImportFile(a.substr(6))
		print("[import_check] import %s -> ok=%s, %s" % [a.substr(6).get_file(), r.ok, r.message])
		if not r.ok:
			failed += 1
			continue
		var errors: Array[String] = []
		var pack := PackLoader.Load("%s/%s" % [FactionRegistry.USER_PACKS_ROOT, r.id], errors)
		print("[import_check] load user://packs/%s: %s" % [r.id, "PASS (Play enabled)" if pack != null else "FAIL " + ", ".join(errors)])
		if pack == null:
			failed += 1
	print("[import_check] packs the picker lists: ", FactionRegistry.ListPackIds())
	quit(1 if failed > 0 else 0)
