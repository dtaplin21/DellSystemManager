import psycopg2

conn = psycopg2.connect(
    dbname="dell_system_manager",
    user="postgres",
    password="mysecretpassword",
    host="localhost"
)