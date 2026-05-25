from flask import Flask, render_template, request, redirect, session
from werkzeug.security import generate_password_hash, check_password_hash

# import custom database functions
from database import add_user, get_user_by_email, add_quote_entry, get_all_quotes, delete_quote_block

# We tell Flask where to look for your frontend folders
app = Flask(__name__, 
            template_folder='../frontend', 
            static_folder='../frontend/static')

# Flask needs a "secret key" to encrypt your session cookies 
# so your friends can't tamper with them and fake being logged in.
app.secret_key = 'super-secret-key-change-this-later'

### ROUTES
# Signup
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'GET':
        return render_template('signup.html')
    if request.method == 'POST':
        # Get user inputs
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        # Hash the password using Werkzeug
        hashed_password = generate_password_hash(password)
        # Add the user
        add_user(name, email, hashed_password)
        # Redirect to the login page
        return redirect('/login')

# Login
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = get_user_by_email(email)

        # Check if user exists
        if user is None:
            return redirect('/login')

        # Check the password using Werkeug
        stored_hash = user[3]
        if check_password_hash(stored_hash, password):
            # Save the name and userID in a session
            session['user_id'] = user[0]
            session['user_name'] = user[1]

            return redirect('/')
        else:
            return redirect('/login')

# Homepage
@app.route('/')
def homepage():
    # Check if the user has a valid login session
    if 'user_id' not in session:
        return redirect('/login')

    # Get unformatted data of quotes
    raw_quotes = get_all_quotes()

    # Group speaker lines by quote blockID
    grouped_quotes = {}
    for row in raw_quotes:
        block_id = row[0]

        # If new blockID, set a new container
        if block_id not in grouped_quotes:
            grouped_quotes[block_id] = {
                'id': block_id,
                'month': row[1],
                'day': row[2],
                'year': row[3],
                'lines': []
            }

        # Append the line details to the block's lines array
        grouped_quotes[block_id]['lines'].append({
            'text': row[4],
            'author': row[5],
            'context': row[6],
            'position': row[7]
        })

    # Pass the dictionary to the HTML file
    return render_template('index.html', quotes=list(grouped_quotes.values()))

# Logout
@app.route('/logout')
def logout():
    # clear() removes everything from the session dictionary, destroying the cookie
    session.clear()
    return redirect('/login')

# Add Quote
@app.route('/add-quote', methods=['POST'])
def add_quote():
    # Security Check: User can't add anything if not logged in
    if 'user_id' not in session:
        return redirect('/login')
    
    # Get user inputs
    quotes_list = request.form.getlist('quote[]')
    speakers_list = request.form.getlist('speaker[]')
    contexts_list = request.form.getlist('context[]')
    positions_list = request.form.getlist('context-position[]')
    
    month = request.form.get('month')
    day = request.form.get('day')
    year = request.form.get('year')

    # Check inputs

    # Save the quote with the userID from the session cookie
    success = add_quote_entry(session['user_id'], month, day, year, quotes_list, speakers_list, contexts_list, positions_list)
    
    # Check for success and give feedback
    # if success:
    #     flash("Quote successfully added!", "success")
    # else:
    #     flash("Something went wrong saving your quote. Please try again.", "error")

    # Redirect to the homepage
    return redirect('/')

# Delete Quote
@app.route('/delete-quote/<int:block_id>', methods=['POST'])
def delete_quote(block_id):
    if 'user_id' not in session:
        return redirect('/login')
        
    # Trigger our deletion transaction
    delete_quote_block(block_id)
    
    # Send them right back to the updated timeline wall
    return redirect('/')

### Run Main
if __name__ == '__main__':
    app.run(debug=True)