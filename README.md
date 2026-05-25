# The Quote Library
A full-stack, responsive web application designed to log, organize, and display multi-speaker conversations and quotes with flexible, fuzzy-dated timelines. Built entirely with vanilla Python, Flask, and SQLite on the backend, and semantic HTML, custom CSS flex layouts, and native vanilla JavaScript on the frontend.

## Key Features
- **Multi-Line Dialogue Logging:** Dynamically clone input rows on the fly using native JavaScript to save full scripts or multi-speaker conversations simultaneously.
- **Relational Parent-Child Database Architecture:** Utilizes structured SQLite foreign keys to group endless lines of text (utterances) under a single metadata block (quote_blocks).
- **Secure Authentication System:** Ironclad user sign-up and login pipelines using secure password salting and cryptographic hashing (werkzeug.security), backed by Flask session cookies.
- **CRUD Lifecycle Complete:** Full execution of data creation, relational data reads using custom multi-level SQL INNER JOIN sorting, and safe, cascading transactional deletions.
- **Modern CSS Component Architecture:** Completely custom responsive UI made with CSS Flex, absolute layout UI element positioning, and interactive hover mechanics.

## Tech Stack & Architecture
- **Frontend:** HTML5, CSS3 (Flexbox), Vanilla JavaScript (ES6+ DOM manipulation)
- **Backend:** Python 3, Flask Web Framework, Jinja2 Templating Engine
- **Database:** SQLite3 (Relational relational tables with customized transactional sequence keys)

### Relational Schema Blueprint
The backend structures database entries across a $1:\text{Many}$ relationship to prevent data repetition and preserve sequence consistency:
```
  ┌──────────────────┐               ┌──────────────────┐
  │   quote_blocks   │               │    utterances    │
  ├──────────────────┤               ├──────────────────┤
  │ id (PK)          │◄──────┐       │ id (PK)          │
  │ user_id (FK)     │       └───────│ quote_block_id   │
  │ month            │               │ quote            │
  │ day_range        │               │ author           │
  │ year             │               │ context          │
  └──────────────────┘               │ context_position │
                                     │ line_order       │
                                     └──────────────────┘
```
## Local Setup & Installation
To run this application locally on your machine for personal use, follow these steps:
1. Clone the Repository
```
git clone https://github.com/yourusername/quote-library.git
cd quote-library
```
2. Set Up a Virtual Environment (Optional but Recommended)
```
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
```
3. Install Dependencies
```
pip install Flask
```
4. Initialize the Relational DatabaseBefore booting up the server for the first time, run the database initializer script to build your local database.db structure:
```
python backend/database.py
```
5. Launch the Application
```
python backend/app.py
```
Open your web browser and navigate to http://127.0.0.1:5000/. Head over to the /signup route to create your local master user profile and begin logging your timeline!
## Engineering Highlights & Key Takeaways
- **Array Parsing Across Network Boundaries:** Instead of reading scalar variables, the Flask route was engineered to capture dynamic multi-row datasets using request.form.getlist('variable[]'), which are zipped synchronously in Python.
- **Deterministic Sequencing:** Implemented zero-dependency chronology tracking inside the database transaction layers using Python's enumerate() function to dynamically compute sequential line_order indexes on the fly.
- **Crawler-Safe Destructive Writes:** Avoided common pre-fetching security flaws by wrapping custom interactive UI close buttons inside distinct, form-backed semantic POST protocols instead of naked GET anchor elements.
