import sqlite3

# Coded with help from Gemini
def init_db():
    # Connect to/create the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Create the USERS table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL
        )
    ''')
    
    # Create the QUOTE_BLOCKS table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quote_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            year INTEGER,
            month TEXT,
            day_range TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # Create the UTTERANCES TABLE
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS utterances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quote_block_id INTEGER NOT NULL,
            quote TEXT NOT NULL,
            author TEXT NOT NULL,
            context TEXT,
            context_position TEXT,
            line_order INTEGER NOT NULL,
            FOREIGN KEY (quote_block_id) REFERENCES quote_blocks(id)
        )
    ''')
    
    # Save and close
    conn.commit()
    conn.close()

def add_user(name, email, hashed_password):
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Try to insert the user data
    try:
        # Use ? placeholders for security to prevent "SQL Injection"
        cursor.execute('''
            INSERT INTO users (name, email, hashed_password)
            VALUES (?, ?, ?)
        ''', (name, email, hashed_password))
        
        # Save the changes to the file
        conn.commit()
        return True
    
    # Exception: new user insertion fails because email already exists
    except sqlite3.IntegrityError:
        print("Email already exists.")
        return False
        
    finally:
        # Close the connection for all cases
        conn.close()

def get_user_by_email(email):
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()

    # We select the whole row where the email matches our parameter
    cursor.execute('''
        SELECT id, name, email, hashed_password 
        FROM users 
        WHERE email = ?
    ''', (email,))

    # Grab the first matching row found (should only be one match anyway)
    #user_row will either be a tuple (id, name, email, hash_password) or None
    user_row = cursor.fetchone()
    
    # Close the connection
    conn.close()
    
    return user_row

# Database initializes upon running this file
if __name__ == '__main__':
    init_db()
    print("Database initialized successfully!")