# Project Board Tables

A web app that generates tables showing the current state of a github project board.

Live site: https://isisbusapps.github.io/project-board-snapshotter/

## Local installation

The app runs entirely in browser using javascript, so all thats needed is a way to open the files in a modern browser (successfully tested on Windows 10 in Chrome 78, Firefox 70 and Edge 44).

Locally, this can either be done by pointing the browser at the files
```
file:///C:/Programming/ISISBusApps/Tools/ProjectBoardTables/index.html
```
or you can run a web server in this projects directory. For instance, with python installed, this can be done in a terminal with one of:
```
python3 -m http.server
python2 -m SimpleHTTPServer
```

## Usage

- Enter the name of the project that you want to generate tables of, and the name of the projects organisation.
- To get the previous status of issues from the correct time, update the date field using the suggested format.
- Enter an API Key.
  - These can be generated at https://github.com/settings/tokens, and must be done by an account that can access the project board and repositories it contains issues from.
  - The key used must have the `read:org` and `repo` permissions.
  - If you run the web app in Chrome, you may see a key icon appear in the address bar after entering the API key. Clicking on this will let you save it for future uses.
