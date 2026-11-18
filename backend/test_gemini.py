from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client()

response = client.models.generate_content(
    model="gemini-3.5-flash-lite",
    contents="赤色(#FF0000)と黄色(#FFFF00)を組み合わせた配色の特徴を1文で解説してください。"
)

print(response.text)