extends SceneTree
## Scratch-copy only: validates each --dir=<folder> with the game's PackLoader.

func _init() -> void:
	var failed := 0
	for a in OS.get_cmdline_user_args():
		if not a.begins_with("--dir="):
			continue
		var dir := a.substr(6)
		var errors: Array[String] = []
		var pack := PackLoader.Load(dir, errors)
		if pack == null or not errors.is_empty():
			failed += 1
			print("[validate_pack] FAIL %s (%d errors)" % [dir, errors.size()])
			for e in errors:
				print("    %s" % e)
		else:
			print("[validate_pack] PASS %s: %d factions, %d planets, %d characters, %d units, %d missions" % [dir, pack.Factions.size(), pack.Map.Planets.size(), pack.Characters.size(), pack.Units.size(), pack.Missions.size()])
	quit(1 if failed > 0 else 0)
