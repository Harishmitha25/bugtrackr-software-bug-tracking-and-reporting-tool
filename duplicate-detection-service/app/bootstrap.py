import os
import requests
from app import embeddings
from dotenv import load_dotenv

load_dotenv() #load the env variables (the similarity api key)

#Bootstrap method to get data from the database through nodejs API to embed them and store in FAISS index
def bootstrap():

    try:
        #Get bugs from the nodejs backend API for embedding
        backend_url = os.getenv("BACKEND_URL", "https://localhost:5000")
        res = requests.get(
            f"{backend_url}/api/bug-reports/for-embedding",
            headers={
                "x-similarity-key": os.getenv("SIMILARITY_API_KEY")
            },
            verify=backend_url != "https://localhost:5000" #skip cert check only for local self-signed cert
        )

        if res.status_code != 200:
            raise Exception("Failed to fetch bugs")

        bugs = res.json()
        # print("Bugsssssssss", bugs)
        for idx, bug in enumerate(bugs):
            if not bug or not isinstance(bug, dict):
                print(f"Skipping invalid bug entry at index {idx}: {bug}")
                continue

            try:
                app_name = bug.get("application")
                if not app_name:
                    print(f"Missing application name for bug at index {idx}")
                    continue

                #Convert the bug data to a single string as the model expects single sentence
                text = embeddings.build_text_input(
                    bug.get("title", ""),
                    bug.get("description", ""),
                    bug.get("stepsToReproduce", ""),
                    bug.get("userSteps") or {}
                )
                
                #add each bug's embedding to the index one by one
                embeddings.add_to_index(app_name, bug.get("bugId"), text)

                #If bug status is "Closed" it goes to the priority classificarion index
                if bug.get("status", "") in ["Closed"]:
                    print(bug)
                    embeddings.add_to_priority_index(app_name, bug.get("bugId"), text)
                    
            except Exception as err:
                print(f"Error processing bug at index {idx}: {err}")

        return {"message": "Bootstrapped", "count": len(bugs)}

    except Exception as err:
        print("Failed to bootstrap:", err)
        return {"message": "Bootstrap failed", "error": str(err)}
