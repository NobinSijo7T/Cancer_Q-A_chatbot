import ingest

import os
import json
from time import time

from groq import Groq
from serpapi import GoogleSearch

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)

# Initialize SerpAPI
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "42514f5d952b02e17097008c383392cb3f98330983d847bb9bc2f7409aeab87f")

# Available models
AVAILABLE_MODELS = {
    "gpt-oss": "llama-3.3-70b-versatile",  # Default Groq model (higher token limit)
    "meditron": "epfl-llm/meditron-7b",  # Optional HuggingFace model (requires access)
}

# For meditron model (lazy loading)
meditron_pipeline = None
meditron_tokenizer = None

def load_meditron():
    """Lazy load meditron model only when needed"""
    global meditron_pipeline, meditron_tokenizer
    
    if meditron_pipeline is None:
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
        from huggingface_hub import login
        
        HF_TOKEN = os.getenv("HF_TOKEN")
        if HF_TOKEN:
            login(token=HF_TOKEN)
            print("Logged in to Hugging Face successfully!")
        
        MODEL_NAME = "epfl-llm/meditron-7b"
        print(f"Loading {MODEL_NAME} model... This may take a few minutes.")
        
        meditron_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, token=HF_TOKEN)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            torch_dtype=torch.float16,
            device_map="auto",
            low_cpu_mem_usage=True,
            token=HF_TOKEN
        )
        
        meditron_pipeline = pipeline(
            "text-generation",
            model=model,
            tokenizer=meditron_tokenizer,
            max_new_tokens=512,
            do_sample=True,
            temperature=0.7,
            top_p=0.95,
        )
        print(f"{MODEL_NAME} model loaded successfully!")
    
    return meditron_pipeline, meditron_tokenizer

index = ingest.load_index()


def search_serpapi(query):
    """Search using SerpAPI for real-time web results"""
    try:
        params = {
            "engine": "google",
            "q": query + " cancer",  # Add cancer context
            "google_domain": "google.com",
            "hl": "en",
            "gl": "us",
            "num": 3,  # Get top 3 results
            "api_key": SERPAPI_KEY
        }
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        sources = []
        if "organic_results" in results:
            for result in results["organic_results"][:3]:
                sources.append({
                    "title": result.get("title", ""),
                    "link": result.get("link", ""),
                    "snippet": result.get("snippet", "")
                })
        
        return sources
    except Exception as e:
        print(f"SerpAPI error: {e}")
        return []

def search(query):
    boost = {}

    results = index.search(
        query=query,
        filter_dict={},
        boost_dict=boost,
        num_results=3  # Reduced to stay within token limits
    )

    return results

prompt_template = """
You're a CANCER expert. Answer the QUESTION based on the CONTEXT from our cancer database and additional web sources.
Use the facts from both the CONTEXT and WEB SOURCES when answering the QUESTION.

IMPORTANT FORMATTING RULES:
- Use **bold** for important terms, cancer types, and key medical terms
- Use *italics* for emphasis
- Use numbered lists (1. 2. 3.) for sequential information or types
- Use bullet points (•) for related items
- Do NOT include URLs or web links in your answer - sources are shown separately
- Structure your answer clearly with proper paragraphs

QUESTION: {question}

CONTEXT FROM DATABASE:
{context}

WEB SOURCES:
{web_sources}
""".strip()

entry_template = """
question: {question}
answer: {answer}
topic: {topic}
""".strip()

def build_prompt(query, search_results, web_sources):
    context = ""
    
    for doc in search_results:
        context = context + entry_template.format(**doc) + "\n\n"
    
    # Format web sources
    web_context = ""
    for idx, source in enumerate(web_sources, 1):
        web_context += f"{idx}. {source['title']}\n   {source['snippet']}\n   URL: {source['link']}\n\n"

    prompt = prompt_template.format(
        question=query, 
        context=context,
        web_sources=web_context if web_context else "No additional web sources available."
    ).strip()
    return prompt


def llm_groq(prompt, model='llama-3.3-70b-versatile'):
    """Use Groq API for text generation"""
    completion = groq_client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.7,
        max_tokens=1024,
        top_p=1,
        stream=False,
    )
    
    answer = completion.choices[0].message.content
    
    token_stats = {
        "prompt_tokens": completion.usage.prompt_tokens,
        "completion_tokens": completion.usage.completion_tokens,
        "total_tokens": completion.usage.total_tokens,
    }
    
    return answer, token_stats


def llm_meditron(prompt):
    """Use Meditron model from HuggingFace"""
    pipe, tokenizer = load_meditron()
    
    # Count input tokens
    input_ids = tokenizer.encode(prompt, return_tensors="pt")
    prompt_tokens = len(input_ids[0])
    
    # Generate response
    response = pipe(prompt, max_new_tokens=512, return_full_text=False)
    answer = response[0]['generated_text'].strip()
    
    # Count output tokens
    output_ids = tokenizer.encode(answer, return_tensors="pt")
    completion_tokens = len(output_ids[0])
    
    token_stats = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
    }
    
    return answer, token_stats


def llm(prompt, model='gpt-oss'):
    """Main LLM function that routes to appropriate backend"""
    if model == 'meditron':
        return llm_meditron(prompt)
    else:
        # Default to Groq's gpt-oss model
        groq_model = AVAILABLE_MODELS.get(model, 'openai/gpt-oss-20b')
        return llm_groq(prompt, groq_model)


def calculate_openai_cost(model, tokens):
    # Groq and local models have different pricing or are free
    return 0.0

evaluation_prompt_template = """
You are an expert evaluator for a RAG system.
Your task is to analyze the relevance of the generated answer to the given question.
Based on the relevance of the generated answer, you will classify it 
as "NON_RELEVANT", "PARTLY_RELEVANT", or "RELEVANT".

Here is the data for evaluation:

Question: {question}
Generated Answer: {answer}

Please analyze the content and context of the generated answer in relation to the original
answer and provide your evaluation in parsable JSON without using code blocks:

{{
  "Relevance": "NON_RELEVANT" | "PARTLY_RELEVANT" | "RELEVANT",
  "Explanation": "[Provide a brief explanation for your evaluation]"
}}
""".strip()

def evaluate_relevance(question, answer, model='gpt-oss'):
    prompt = evaluation_prompt_template.format(question=question, answer=answer)
    evaluation, tokens = llm(prompt, model=model)

    try:
        json_eval = json.loads(evaluation)
        return json_eval, tokens
    except json.JSONDecodeError:
        result = {"Relevance": "UNKNOWN", "Explanation": "Failed to parse evaluation"}
        return result, tokens

def rag(query, model='gpt-oss'):
    """
    Main RAG function.
    
    Args:
        query: The question to answer
        model: 'gpt-oss' (default, uses Groq) or 'meditron' (uses HuggingFace)
    """
    t0 = time()

    # Search local database
    search_results = search(query)
    
    # Search web using SerpAPI
    web_sources = search_serpapi(query)
    
    # Build prompt with both sources
    prompt = build_prompt(query, search_results, web_sources)
    answer, token_stats = llm(prompt, model=model)

    relevance, rel_token_stats = evaluate_relevance(query, answer, model=model)


    t1 = time()
    took = t1 - t0

    openai_cost_rag = calculate_openai_cost(model, token_stats)
    openai_cost_eval = calculate_openai_cost(model, rel_token_stats)

    openai_cost = openai_cost_rag + openai_cost_eval

    answer_data = {
        "answer": answer,
        "model_used": model,
        "response_time": took,
        "relevance": relevance.get("Relevance", "UNKNOWN"),
        "relevance_explanation": relevance.get(
            "Explanation", "Failed to parse evaluation"
        ),
        "prompt_tokens": token_stats["prompt_tokens"],
        "completion_tokens": token_stats["completion_tokens"],
        "total_tokens": token_stats["total_tokens"],
        "eval_prompt_tokens": rel_token_stats["prompt_tokens"],
        "eval_completion_tokens": rel_token_stats["completion_tokens"],
        "eval_total_tokens": rel_token_stats["total_tokens"],
        "openai_cost": openai_cost,
        "sources": web_sources,  # Add web sources to response
    }
    return answer_data


# if __name__ == "__main__":
#     question = "What are different types of lung cancers?"
#     answer = rag(question)
#     print(answer)