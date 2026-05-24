from flask import Flask, render_template, request, redirect, session
from werkzeug.security import generate_password_hash, check_password_hash

# import custom database functions
from database import add_user, get_user_by_email 

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
        
    # If they ARE logged in, serve your main index.html webpage
    return render_template('index.html')

# Logout
@app.route('/logout')
def logout():
    # clear() removes everything from the session dictionary, destroying the cookie
    session.clear()
    return redirect('/login')

if __name__ == '__main__':
    app.run(debug=True)