import psycopg2

conn = psycopg2.connect(
    dbname="QC Automation",
    user="postgres",
    password="Qualitydata790",
    host="aws-0-us-east-2.pooler.supabase.com"
)