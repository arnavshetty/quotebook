import psycopg2

DB_URI = "***REMOVED***"

def get_db_connection():
    """Establishes a secure network connection to your Supabase cloud database."""
postgresql://REDACTED

# Coded with help from Gemini
def init_db():
    # Connect to/create the database
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create the USERS table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL
        )
    ''')
    
    # Create the QUOTE_BLOCKS table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quote_blocks (
            id SERIAL PRIMARY KEY,
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
            id SERIAL PRIMARY KEY,
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
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Try to insert the user data
    try:
        # Use %s placeholders for security to prevent "SQL Injection"
        cursor.execute('''
            INSERT INTO users (name, email, hashed_password)
            VALUES (%s, %s, %s)
        ''', (name, email, hashed_password))
        
        # Save the changes to the file
        conn.commit()
        return True
    
    except psycopg2.Error as e:
        # '23505' is the universal SQL standard error code for a Unique Violation
        if getattr(e, 'pgcode', None) == '23505':
            print("Email already exists.")
        else:
            print(f"Database error: {e}")
        return False
    
    # Close the connection in all cases
    finally:
        conn.close()

def get_user_by_email(email):
    # Connect to the database
    conn = get_db_connection()
    cursor = conn.cursor()

    # We select the whole row where the email matches our parameter
    cursor.execute('''
        SELECT id, name, email, hashed_password 
        FROM users 
        WHERE email = %s
    ''', (email,))

    # Grab the first matching row found (should only be one match anyway)
    user_row = cursor.fetchone()
    
    # Close the connection
    conn.close()
    
    return user_row

def add_quote_entry(user_id, month, day, year, quotes, speakers, contexts, positions):
    # Connect to the database
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Convert empty or blank year strings safely to integers for PostgreSQL
        formatted_year = int(year) if year and str(year).strip().isdigit() else None
        
        # Insert the parent block container
        cursor.execute('''
            INSERT INTO quote_blocks (user_id, year, month, day_range)
            VALUES (%s, %s, %s, %s) RETURNING id
        ''', (user_id, formatted_year, month, day))
        
        # Get the returned ID of the quote_block we just created
        new_block_id = cursor.fetchone()[0]
        
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
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (new_block_id, quote, speaker, context, position, line_order))

        # Close the connection
        conn.commit()
        return True

    # Error Handling
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        return False

    # Close the connection in all cases
    finally:
        conn.close()

def get_all_quotes():
    # Connect to the database
    conn = get_db_connection()
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
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Remove all the child utterances linked to the quote block
        cursor.execute('DELETE FROM utterances WHERE quote_block_id = %s', (block_id,))
        
        # Remove the parent quote block container
        cursor.execute('DELETE FROM quote_blocks WHERE id = %s', (block_id,))
        
        # Close the connnection
        conn.commit()
        return True
    
    # Error Handling
    except psycopg2.Error as e:
        print(f"Database deletion error: {e}")
        return False

    # Close the connection in all cases
    finally:
        conn.close()

# Database initializes upon running this file
if __name__ == '__main__':
    init_db()
    print("Database initialized successfully!")