OFFO Local Vehicle Images
=========================

Place vehicle image files in this folder. They are served by Next.js at:
  /vehicles/filename.jpg

Reference them in data/vehicle-images.csv as:
  /vehicles/filename.jpg

Recommended naming convention:
  {make}-{model}-{year}-{angle}.jpg
  e.g. tesla-model-3-2024-front.jpg
       ford-mach-e-2023-side.jpg

Supported formats: .jpg, .jpeg, .png, .webp, .avif

Images are served with Next.js static file handling — no build step needed.
Just drop files here and update the CSV.
