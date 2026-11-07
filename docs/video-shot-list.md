# App walkthrough video: shot list

A 45 to 60 second screen recording of the real app in the iOS Simulator, with a visible mouse cursor moving to each icon. Used on stoicmirror.com and as a clip for Katherine's posts. Target export: 9:16, 1080x1920, 30 fps, H.264, captions burned in.

Rules from Katherine's plan: say "coming soon", never "download now". Show only features that exist today. No personal details on screen. No medical or results claims in captions or voice-over.

## Before you record (once)

1. **Test account.** Use a clean account with no personal history. Run the search once first and keep a concern whose results you like. Leave all concerns deselected (Settings → Your concerns), so no "Matching…" pill shows on the Counsel tab. Concerns are chosen during sign-up, which this video skips.
2. **First-save prompt.** The first time a quote is saved, the app asks once whether to make a slideshow. Either use it on camera or dismiss it with "Not now" before filming. To see it again, delete the app from the Simulator and reinstall. Also save 3 quotes before filming so the library has plenty to choose from.
3. **Simulator.** Pick a recent iPhone model. Hide the phone frame (Window menu, turn off the device bezel). Turn on I/O → Keyboard → Connect Hardware Keyboard so you can type from your Mac.
4. **Clean status bar.** In Terminal: `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4`
5. **Clear distractions.** Turn on Do Not Disturb on the Mac, close other windows, and hide the Dock.
6. **Recorder.** Press Cmd+Shift+5, choose Record Selected Portion around the Simulator screen, and in Options turn on **Show Mouse Clicks** and choose a location to save.
7. **Music.** Pick the soundtrack you'll choose on camera. Keep that audio file handy, because a Simulator recording has no sound and you'll add the same track in CapCut.
8. **Rehearse the whole path twice** before recording. Move the mouse slowly and in straight lines, and pause for a beat before each click.

## Shots

| Time | Screen | What the cursor does | Notes |
|---|---|---|---|
| 0:00 to 0:03 | Counsel tab, "What troubles you?" | Rests near the text box | Hold still. This is the opening frame. |
| 0:03 to 0:11 | Same | Clicks the text box, then you type: *I can't stop worrying about a meeting tomorrow.* | Type at a natural speed, about 8 seconds. Fix typos in a retake, not live. |
| 0:11 to 0:13 | Same | Moves to **Seek Counsel** and clicks | |
| 0:13 to 0:16 | Loading screen | Rests off to the side | Trim the wait in editing if it's longer than 3 seconds. |
| 0:16 to 0:23 | **Received Wisdom** | Scrolls slowly through the passages | Hold 2 seconds on the first passage and its counsel so viewers can read it. |
| 0:23 to 0:29 | Same | Clicks the **bookmark** icon on 2 or 3 passages | About 1.5 seconds between clicks. The icon fills in when saved. |
| 0:29 to 0:33 | History tab, **Saved Wisdom** | Clicks the History tab, rests on the **Make a slideshow** banner | Hold 2 seconds so the banner can be read. |
| 0:33 to 0:36 | Banner | Clicks **Start**, types a name such as *Evening*, clicks **Create** | Opens the slideshow screen with its three steps. |
| 0:36 to 0:48 | Slideshow screen, step 1 | Clicks **Add** → **From Saved Quotes** → picks a quote → picks a background → clicks **Add to slideshow**, then **Back to Slideshow** | Repeat for 3 slides. Speed this section up 2x in CapCut. |
| 0:48 to 0:52 | Step 2, **Music** | Clicks **Choose** and picks a soundtrack | The step now shows the soundtrack's name. |
| 0:52 to 1:00 | Step 3, **Play** | Clicks **Play**, then moves the mouse out of the frame | Let at least two slides cross-fade. This is the final shot. |
| Last 2 to 3 sec | End card (added in CapCut) | None | Text in the middle of the frame: "The Stoic Mirror. Coming soon. Link in bio to get notified." Instagram's buttons cover the bottom. |

Raw run time is about 60 seconds. After the 2x speed-up of the slideshow-building section and trimming the loading wait, it lands around 50. For the website, trim to 45 seconds or less (for example, shorten the scroll through the passages and the bookmark clicks), or keep the full version for social.

## Editing in CapCut

1. Import the screen recording and trim to the shot order above.
2. Speed up the "make the slideshow" section 2x, and cut dead time in the loading screen.
3. Add the soundtrack audio under the whole clip, fading in at the start and out at the end. Keep it quiet if there's a voice-over.
4. Add Katherine's voice-over and captions with your existing CapCut caption template, if you want narration.
5. Add the end card text.
6. Do a muted playthrough, then export at 1080x1920, 30 fps.

## For the website

- Trim to 45 seconds or less, or use a shorter cut with the slideshow setup sped up. Keep the MP4 under about 8 MB (H.264, no audio track if it plays muted).
- Plan to embed it muted, looping, with a poster image, and a button to play it with sound.
- Hand the final MP4 to Claude and ask for the video section to be added under "How it works".

## Open questions

- Should the website video replace the interactive "Try a sample" demo, or sit above it?
- Narrated by Katherine, or captions and music only?
- Which soundtrack should the slideshow use?
