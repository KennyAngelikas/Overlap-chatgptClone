from flask import Flask, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'mydb'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'password'),
    'port': os.getenv('DB_PORT', '5432')
}

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    """Initialize database with sample table"""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

@app.route('/')
def home():
    return jsonify({'message': 'Flask PostgreSQL API is running'})

@app.route('/users', methods=['GET'])
def get_users():
    """Get all users"""
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('SELECT * FROM users ORDER BY id')
                users = cur.fetchall()
        return jsonify(users), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Get a specific user"""
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('SELECT * FROM users WHERE id = %s', (user_id,))
                user = cur.fetchone()
        
        if user:
            return jsonify(user), 200
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/users', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        
        if not name or not email:
            return jsonify({'error': 'Name and email are required'}), 400
        
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    'INSERT INTO users (name, email) VALUES (%s, %s) RETURNING *',
                    (name, email)
                )
                new_user = cur.fetchone()
        
        return jsonify(new_user), 201
    except psycopg2.IntegrityError:
        return jsonify({'error': 'Email already exists'}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update a user"""
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    'UPDATE users SET name = %s, email = %s WHERE id = %s RETURNING *',
                    (name, email, user_id)
                )
                updated_user = cur.fetchone()
        
        if updated_user:
            return jsonify(updated_user), 200
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM users WHERE id = %s RETURNING id', (user_id,))
                deleted = cur.fetchone()
        
        if deleted:
            return jsonify({'message': 'User deleted successfully'}), 200
        return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)