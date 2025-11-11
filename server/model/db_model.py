import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from psycopg2.pool import ThreadedConnectionPool
import os
from dotenv import load_dotenv

load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'mydb'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'password'),
    'port': os.getenv('DB_PORT', '5432')
}

# --- Global Connection Pool ---
# This is created ONCE when your application starts.
# We use SimpleConnectionPool for a general-purpose pool.
# For multi-threaded apps, consider ThreadedConnectionPool.
try:
    # Change this class
    connection_pool = ThreadedConnectionPool(  # <-- Use this one
        minconn=1, 
        maxconn=20, 
        **DB_CONFIG
    )
    print("Connection pool created successfully.")
except (Exception, psycopg2.DatabaseError) as error:
    print(f"Error while creating connection pool: {error}")
    connection_pool = None

@contextmanager
def get_db_connection():
    """
    Context manager to get a connection from the pool.
    It 'borrows' a connection and returns it when done.
    
    Usage:
        with get_db_connection() as conn:
            # conn is now a valid, open connection from the pool
            ...
    """
    if connection_pool is None:
        raise Exception("Connection pool is not initialized. Please check startup errors.")
        
    conn = None
    try:
        # Get a connection from the pool
        conn = connection_pool.getconn() 
        yield conn
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            # Return the connection to the pool instead of closing it
            connection_pool.putconn(conn)

@contextmanager
def get_db_cursor(dict_cursor=True):
    """
    Context manager that gets a connection from the pool and provides a cursor.
    Automatically handles commit/rollback and returns the connection to the pool.
    
    Usage:
        with get_db_cursor() as (conn, cur):
            cur.execute('SELECT * FROM table')
            results = cur.fetchall()
    """
    if connection_pool is None:
        raise Exception("Connection pool is not initialized. Please check startup errors.")

    conn = None
    cur = None
    try:
        # Get a connection from the pool
        conn = connection_pool.getconn()
        cursor_factory = RealDictCursor if dict_cursor else None
        cur = conn.cursor(cursor_factory=cursor_factory)
        
        yield conn, cur
        
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if cur:
            cur.close()
        if conn:
            # Return the connection to the pool for reuse
            connection_pool.putconn(conn)

def close_all_connections():
    """
    Call this function when your application is shutting down
    to gracefully close all connections in the pool.
    """
    if connection_pool:
        connection_pool.closeall()
        print("Connection pool closed.")