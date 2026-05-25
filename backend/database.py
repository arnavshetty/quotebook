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
    
    # Close the connection in all cases
    finally:
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

def add_quote_entry(user_id, month, day, year, quotes, speakers, contexts, positions):
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()

    try:
        # Insert the parent block container
        cursor.execute('''
            INSERT INTO quote_blocks (user_id, year, month, day_range)
            VALUES (?, ?, ?, ?)
        ''', (user_id, year, month, day))
        
        # Get the auto-generated ID of the quote_block we just created
        new_block_id = cursor.lastrowid
        
        # Loop through all submitted rows sequentially
        for index, (quote, speaker, context, position) in enumerate(zip(quotes, speakers, contexts, positions)):
            # Skip empty rows
            if not quote or not quote.strip():
                continue
            if not speaker or not speaker.strip():
                speaker = "Anonymous"
                
            line_order = index + 1
            
            cursor.execute('''
                INSERT INTO utterances (quote_block_id, quote, author, context, context_position, line_order)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (new_block_id, quote, speaker, context, position, line_order))

        # Close the connection
        conn.commit()
        return True

    # Error Handling
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False

    # Close the connection in all cases
    finally:
        conn.close()

def get_all_quotes():
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()

    # Select fields from both tables, linking them where the IDs match
    # Sort quotes by block ID and then by line_order
    cursor.execute('''
        SELECT qb.id AS block_id, qb.month, qb.day_range, qb.year,
            ut.quote, ut.author, ut.context, ut.context_position, ut.line_order
        FROM quote_blocks qb
        INNER JOIN utterances ut ON qb.id = ut.quote_block_id
        ORDER BY qb.id DESC, ut.line_order ASC
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    return rows

def delete_quote_block(block_id):
    # Connect to the database
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    try:
        # Remove all the child utterances linked to the quote block
        cursor.execute('DELETE FROM utterances WHERE quote_block_id = ?', (block_id,))
        
        # Remove the parent quote block container
        cursor.execute('DELETE FROM quote_blocks WHERE id = ?', (block_id,))
        
        # Close the connnection
        conn.commit()
        return True
    
    # Error Handling
    except sqlite3.Error as e:
        print(f"Database deletion error: {e}")
        return False

    # Close the connection in all cases
    finally:
        conn.close()

# Database initializes upon running this file
if __name__ == '__main__':
    init_db()
    print("Database initialized successfully!")