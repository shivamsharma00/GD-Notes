# Packaging the Application

1. Install `electron-packager` globally:
   ```bash
   npm install -g electron-packager
   ```

2. Run the following command to package your application:

```bash
electron-packager . StickyNotes --platform=win32 --arch=x64 --out=./dist
```

This will create a `StickyNotes` folder in your current directory with the packaged application.


