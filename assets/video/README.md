Put website videos here (e.g. `hero.mp4`, `hero-mobile.mp4`), then enter the path
`assets/video/hero.mp4` in the admin → Home page → Hero video.

Keep files small: 1920px wide, 10–30 s, no audio unless needed, under ~10 MB.
GitHub refuses files over 100 MB.

Compress with ffmpeg:
  ffmpeg -i input.mov -vf "scale=1920:-2,fps=25" -c:v libx264 -crf 28 -preset slow -profile:v high -pix_fmt yuv420p -movflags +faststart -an hero.mp4
Phone version (vertical crop):
  ffmpeg -i input.mov -vf "crop=ih*9/16:ih,scale=720:-2,fps=25" -c:v libx264 -crf 29 -preset slow -pix_fmt yuv420p -movflags +faststart -an hero-mobile.mp4
Still image (first frame) for the poster:
  ffmpeg -i hero.mp4 -frames:v 1 -q:v 3 hero-poster.jpg
