# Focus Slides

A fullscreen focus timer. Pictures drift across the screen while the timer runs, a small circle at the top shows the time, and when it ends a face pops up and says "Time's up". Click the circle for break mode, a bubble map you can arrange like Obsidian's graph view.

## Run it (Linux or Windows)
1. Install Node.js (https://nodejs.org)
2. In this folder:
   ```
   npm install
   npm start
   ```

## Controls
- Space: start or pause. B: break mode. F: fullscreen. T: light or dark. S: settings. ?: shortcut guide. Esc: close the open panel, modal, or alarm.
- Move the mouse to show the controls. They hide after 3 seconds.
- Minimize button: leaves fullscreen and minimizes. The alarm brings the window back to the front.
- Break mode bubbles: double-click empty space to add one, double-click a bubble to edit and categorize (Idea, Distraction, Next Task), drag to move, Shift-drag from one bubble to another to link, right-click to remove. The map is saved automatically. Use "Return to Timer" to head back.

## Your pictures & collections
- In Settings, click **"+ Add pictures"** to choose new photos (jpg, png, or webp) directly from your computer. Your custom pictures are saved in your user data directory without replacing the default images.
- Use **"Slide collection to play"** in Settings to choose:
  - **Combined**: Plays both default images and your added custom images.
  - **Default images only**: Plays only the bundled default images.
  - **Custom images only**: Plays only the pictures you added extra.
- You can also click **"Open custom folder"** to manually manage your image files.

## Make an installer
Run these on the matching system:
```
npm run dist:linux     (AppImage)
npm run dist:win       (Windows installer)
```
The result goes in `dist/`.
