import os
from fastapi import FastAPI, Depends, Header, HTTPException
from app.models import BugInput, BugAdd, SearchQuery
from app import embeddings
from dotenv import load_dotenv
from app.bootstrap import bootstrap

load_dotenv()

#Only the nodejs backend should be able to call this service
def verify_similarity_key(x_similarity_key: str = Header(None)):
    if not x_similarity_key or x_similarity_key != os.getenv("SIMILARITY_API_KEY"):
        raise HTTPException(status_code=403, detail="Unauthorized. Invalid similarity API key")

app = FastAPI(dependencies=[Depends(verify_similarity_key)])

#Run this function when the app starts (to preload existing bug embeddings)
@app.on_event("startup")
def trigger_bootstrap():
    try:
        bootstrap()
        print("jygikhbjbkjnj")
    except Exception as e:
        print("Failed to bootstrap:", e)

#Endpoint to check if a bug is a possible duplicate
@app.post("/check-duplicate")
def check_duplicate(bug: BugInput):
    print(bug)
    if not bug.application:
        return {"error": "Application is required for duplicate check."}
    
    #Convert bug fields into a single string
    text = embeddings.build_text_input(
        bug.title,
        bug.description,
        bug.stepsToReproduce,
        bug.userSteps or {}
    )
    #Get similar bugs based on embedding similarity
    results = embeddings.search_similar(bug.application, text)

    #Return bug ids and similarity scores
    similar_bugs = []
    for r in results:
        similar_bugs.append({
            "bug_id": r[0],
            "score": r[1]
        })
    return {"similar_bugs": similar_bugs}

#Endpoint to seach the bug database semantically(based on meaning rather than exact words)
@app.post("/search/semantic")
def semantic_search(query_data: SearchQuery):
    if not query_data.application or not query_data.query:
        return {"error": "Application and query fields are required"}

    query_text = query_data.query.strip()

    #Perform semantic similarity search
    results = embeddings.search_similar(query_data.application, query_text, min_score=0.4)

    similar_bugs = [
        {"bug_id": bug_id, "score": score}
        for bug_id, score in results
    ]

    return {"similar_bugs": similar_bugs}

#Endpoint to get priority of similar bug from database
@app.post("/similar-bugs-for-classify-priority")
def classify_proirity(query_data: SearchQuery, min_score: float = 0.5):
    print("inside classify-priority endpoint code")

    if not query_data.application or not query_data.query:
        return {"error": "Application and query fields are required"}

    query_text = query_data.query.strip()

    # print(query_text)
    # print(query_data.application)

    #Perform semantic similarity search
    results = embeddings.search_similar_priority_bugs(
        query_data.application,
        query_text,
        min_score=min_score
    )

    similar_bugs = [
        {"bug_id": bug_id, "score": score}
        for bug_id, score in results
    ]

    print(similar_bugs)

    return {"similar_bugs": similar_bugs}

#Add new bug embedding to the index
@app.post("/add-embedding")
def add_embedding(bug: BugAdd):
    if not bug.application:
        return {"error": "Application is required to add embedding."}

    text = embeddings.build_text_input(
        bug.title,
        bug.description,
        bug.stepsToReproduce,
        bug.userSteps or {}
    )
    embeddings.add_to_index(bug.application, bug.bugId, text)
    return {"message": "Embedding added"}

#Add closed bug embedding to priority classification index
@app.post("/add-priority-embedding")
def add_priority_embedding(bug: BugAdd):
    if not bug.application:
        return {"error": "Application is required to add priority embedding."}

    text = embeddings.build_text_input(
        bug.title,
        bug.description,
        bug.stepsToReproduce,
        bug.userSteps or {}
    )
    embeddings.add_to_priority_index(bug.application, bug.bugId, text)
    return {"message": "Priority embedding added"}
