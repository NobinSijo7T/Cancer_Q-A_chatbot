# Cancer_Q-A_chatbot
LLM-based chatbot for cancer-related questions and patient education.

This project was implemented for LLM Zoomcamp – a free course about LLMs and RAG.


<p align="center">
  <img src="images/demo.png">
</p>

## Project overview

The Cancer Chatbot Assistant is a Retrieval-Augmented Generation (RAG) application designed to assist users with their cancer-related questions.

The main use cases include:

1. Learning about various cancer types.
2. Understanding precautions, risk factors, and diagnosis for different cancers.
3. Exploring a curated knowledge base of cancer-related questions, terminology, and general information.


## Architecture

At a high level, the system consists of the following components:

1. **API layer (Flask)** – REST API that exposes endpoints for asking questions (`/question`) and providing feedback (`/feedback`). Implemented in `Cancer_chatbot/app.py`.
2. **RAG engine** – Handles retrieval and generation:
  - Retrieves relevant Q&A entries using a lightweight in-memory search engine (Minsearch).
  - Builds a structured prompt from the retrieved documents.
  - Calls an LLM (via Groq or optional Meditron) to generate the final answer and a relevance evaluation.
  - Implemented in `Cancer_chatbot/rag.py` and `Cancer_chatbot/ingest.py`.
3. **Search index (Minsearch)** – In-memory full-text search over the Q&A dataset, implemented in `Cancer_chatbot/minsearch.py` and populated via `Cancer_chatbot/ingest.py`.
4. **Persistence layer (PostgreSQL)** – Optional logging of conversations and user feedback for monitoring and analytics, implemented in `Cancer_chatbot/db.py` and initialized via `Cancer_chatbot/db_prep.py`.
5. **Monitoring (Grafana)** – Dashboards for tracking usage, latency, relevance, feedback, and token/cost metrics using PostgreSQL as the data source.

**Typical request flow:**

1. User sends a question to `/question`.
2. The RAG engine retrieves top-matching Q&A entries from Minsearch.
3. A prompt is constructed and sent to the configured LLM backend.
4. The generated answer and evaluation metadata are returned, optionally logged to PostgreSQL, and surfaced back to the client.
5. The user may later send feedback to `/feedback`, which is stored in the database and visualized in Grafana.


## Dataset 

The dataset used in this project contains information about Cancer related data, including:

1. Question
2. Answers (large chunk of text)


You can find the data in [`data/CancerQA_data.csv`](data/CancerQA_data.csv).

## Technologies

* Python 3.12
* Flask as the API interface (see Background for more information on Flask)
* [Minsearch](https://github.com/alexeygrigorev/minsearch) for in-memory full-text search
* Groq-hosted LLMs (default: `llama-3.3-70b-versatile`) for answer generation and evaluation
* Optional Meditron 7B model from HuggingFace for local/alternative medical LLM inference
* PostgreSQL for logging conversations and feedback
* Grafana for monitoring and visualization
* Docker and Docker Compose for containerization and orchestration


## LLM models

The RAG engine supports two main model backends, configured in `Cancer_chatbot/rag.py`:

1. **Groq (default)**
  - Model key: `gpt-oss`
  - Backed by Groq's `llama-3.3-70b-versatile` chat model.
  - Used for both answer generation and relevance evaluation.
  - Requires `GROQ_API_KEY` to be set in your environment.

2. **Meditron (optional, via HuggingFace)**
  - Model key: `meditron`
  - Uses `epfl-llm/meditron-7b` loaded through `transformers`.
  - Intended as an experimental medical-domain LLM for on-device / custom deployments.
  - Requires a valid HuggingFace access token (`HF_TOKEN`) with access to the model.

You can switch between backends by passing the `model` argument to the `rag` function (e.g. `rag(question, model="meditron")`). The API currently defaults to `gpt-oss`.


## Languages and key packages

**Languages**

* Python 3.12 (core application, RAG pipeline, ingestion, monitoring helpers)
* SQL (PostgreSQL schema and queries inside the Python code)

**Key Python packages** (see `requirements.txt` for the full list)

* Web/API: `flask`, `python-dotenv`, `requests`
* LLMs: `groq`, `openai` (legacy support), `transformers`, `torch`, `accelerate`, `huggingface_hub`
* Data & ML utilities: `pandas`, `scikit-learn`
* Database: `psycopg2-binary`
* CLI: `questionary`
* Dev & notebooks: `pytest`, `ipykernel`, `jupyter`


## Project setup

### Environment variables

The application relies on a few environment variables. Typical local `.env` or `.envrc` settings include:

* **RAG / LLMs**
  * `GROQ_API_KEY` – required for the default Groq-backed model.
  * `HF_TOKEN` – optional, required only if you want to use the Meditron model from HuggingFace.
* **Data**
  * `DATA_PATH` – path to the CSV dataset (default: `data/CancerQA_data.csv`).
* **Database / monitoring (optional, for PostgreSQL + Grafana)**
  * `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  * `USE_DB=1` to enable database logging (set to `0` or omit to disable).
  * `RUN_TIMEZONE_CHECK` and `TZ` – optional debugging flags for time zone checks.

If you use `direnv`, a typical workflow is:

1. Install `direnv`. On Ubuntu: `sudo apt install direnv` and then `direnv hook bash >> ~/.bashrc`.
2. Copy `.envrc_template` into `.envrc` and insert your keys and settings there.
3. Run `direnv allow` to load the variables into your environment.

Alternatively, you can create a standard `.env` file in the project root (loaded by `python-dotenv`).

### Installing dependencies

You can use either `pip` (with `requirements.txt`) or `pipenv` (original setup from LLM Zoomcamp).

**Option 1 – pip + requirements.txt**

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
```

**Option 2 – pipenv**

For dependency management, we use pipenv, so you need to install it:

```bash
pip install pipenv
```

Once installed, you can install the app dependencies:

```bash
pipenv install --dev
```

## Running the application

### Database configuration

Before the application starts for the first time, the database needs to be initialized.

First, run `postgres`:

```bash
docker-compose up postgres
```

Then run the db_prep.py script:

```bash
pipenv shell

cd Cancer_chatbot

export POSTGRES_HOST=localhost
python db_prep.py
```

To check the content of the database, use pgcli (already installed with pipenv):

```bash
pipenv run pgcli -h localhost -U your_username -d course_assistant -W
```

You can view the schema using the \d command:

```bash
\d conversations;
```

And select from this table:

```bash
select * from conversations;
```

### Running with Docker-Compose

The easiest way to run the application is with docker-compose:

```bash
docker-compose up
```

### Running locally

If you want to run the application locally, start only postres and grafana:

```bash
docker-compose up postgres grafana
```

If you previously started all applications with docker-compose up, you need to stop the app:

```bash
docker-compose stop app
```
Now run the app on your host machine:

```bash
pipenv shell

cd Cancer_chatbot

export POSTGRES_HOST=localhost
python app.py
```

### Running with Docker (without compose)

Sometimes you might want to run the application in Docker without Docker Compose, e.g., for debugging purposes.

First, prepare the environment by running Docker Compose as in the previous section.

Next, build the image:

```bash
docker build -t cancer_chatbot .
```

And run it:

```bash
docker run -it --rm \
    --env-file=".env" \
    -e OPENAI_API_KEY=${OPENAI_API_KEY} \
    -e DATA_PATH="data/CancerQA_data.csv" \
    -p 5001:5001 \
    cancer_chatbot
```

## Using the application

### 📱 Mobile App (Recommended - Easiest)

The mobile app provides a beautiful, modern interface with automatic backend startup:

```bash
cd mobile
npm install
npm start
```

This single command will:
1. ✅ Automatically start the Flask backend in the background
2. ✅ Launch the Expo development server
3. ✅ Display a QR code for mobile testing

**To use:**
- Press `w` to open in web browser
- Press `a` to open in Android emulator
- Scan QR code with Expo Go app on your phone

Features:
- Clean, modern UI with light theme
- Bold and italic text formatting
- Clickable source links from web search
- Connection status indicator
- Real-time chat experience

See [mobile/README.md](mobile/README.md) for more details.

---

When the application is running, we can start using it.

### CLI

We built an interactive CLI application using [questionary] (https://questionary.readthedocs.io/en/stable/) .

To start it, run:
```bash
pipenv run python cli.py
```

You can also make it randomly select a question from our ground truth dataset:

```bash
pipenv run python cli.py --random
```

### Using `requests`

When the application is running, you can use requests to send questions—use test.py for testing it:

```bash
pipenv run python test.py
```

It will pick a random question from the ground truth dataset and send it to the app.

### CURL

You can also use `curl` for interacting with the API:

```bash
URL=http://localhost:5001
QUESTION="What are different types of breast cancers?"
DATA='{
    "question": "'${QUESTION}'"
}'

curl -X POST \
    -H "Content-Type: application/json" \
    -d "${DATA}" \
    ${URL}/question
```

You will see something like the following in the response:

```json
{
  "answer": "Different types of breast cancers include:\n\n1. **Ductal Carcinoma**: This is the most common type of breast cancer, which begins in the cells of the ducts.\n2. **Lobular Carcinoma**: This type of cancer originates in the lobules and is more often found in both breasts compared to other types.\n3. **Inflammatory Breast Cancer**: An uncommon type characterized by a warm, red, and swollen breast.\n4. **Ductal Carcinoma In Situ (DCIS)**: A noninvasive condition where abnormal cells are found in the lining of a breast duct.\n5. **Lobular Carcinoma In Situ (LCIS)**: Abnormal cells found in the lobules, which seldom becomes invasive cancer.\n6. **Paget Disease of the Nipple**: Involves abnormal cells in the nipple only. \n\nFor male breast cancer, common types include infiltrating ductal carcinoma, ductal carcinoma in situ, inflammatory breast cancer, and Paget disease of the nipple.",
  "conversation_id": "6681f8f8-60ee-459a-9151-aa9b6377b53f",
  "question": "What are different types of breast cancers?"
}
```

### Sending feedback:

```bash
ID="6681f8f8-60ee-459a-9151-aa9b6377b53f"
URL=http://localhost:500`
FEEDBACK_DATA='{
    "conversation_id": "'${ID}'",
    "feedback": 1
}'

curl -X POST \
    -H "Content-Type: application/json" \
    -d "${FEEDBACK_DATA}" \
    ${URL}/feedback
```
After sending it, you'll receive the acknowledgement:

```json
{
    "message": "Feedback received for conversation 4e1cef04-bfd9-4a2c-9cdd-2771d8f70e4d: 1"
}
```

## Code

The code for the application is in the `Cancer_chatbot` folder:

- [`app.py`](Cancer_chatbot/app.py) - the Flask API, the main entrypoint to the application
- [`rag.py`](Cancer_chatbot/rag.py) - the main RAG logic for building the retrieving the data and building the prompt
- [`ingest.py`](Cancer_chatbot/ingest.py) - loading the data into the knowledge base
- [`minsearch.py`](Cancer_chatbot/minsearch.py)  - an in-memory search engine
- [`db.py`](Cancer_chatbot/db.py) - the logic for logging the requests and responses to postgres
- [`db_prep.py`](Cancer_chatbot/db_prep.py) - the script for initializing the database

We also have some code in the project root directory:

[`test.py`](test.py) - select a random question for testing.
[`cli.py`](cli.py) - interactive CLI for the APP.

### Interface

We use Flask for serving the application as an API.

Refer to the "Using the Application" section for examples on how to interact with the application.

### Ingestion

The ingestion script is in [`ingest.py`](Cancer_chatbot/ingest.py).

Since we use an in-memory database, minsearch, as our knowledge base, we run the ingestion script at the startup of the application.

It's executed inside [`rag.py`](Cancer_chatbot/rag.py) when we import it.

### Experiments

For experiments, we use Jupyter notebooks. They are in the notebooks folder.

To start Jupyter, run:
```bash
cd notebooks
pipenv run jupyter notebook
```

We have the following notebooks:

- [`rag-test.ipynb`](notebooks/rag-test.ipynb): The RAG flow and evaluating the system.
- [`evaluation-data-generation.ipynb`](notebooks/evaluation-data-generation.ipynb): Generating the ground truth dataset for retrieval evaluation.

### Retrieval evaluation

The basic approach - using `minsearch` without any boosting - gave the following metrics:

- Hit rate: 91%
- MRR: 52%

The improved version (with tuned boosting):

- Hit rate: 94%
- MRR: 54%

The best boosting parameters:

```python
boost = {
        'question': 2.21,
        'answer': 7.84
}
```

### RAG flow evaluation

We used the LLM-as-a-Judge metric to evaluate the quality of our RAG flow.

For gpt-4o-mini, in a sample with 600 records, we had:

- 554 (91%) RELEVANT
- 53 (8.9%) PARTLY_RELEVANT
- 3 (0.05%) NON_RELEVANT

We also tested gpt-4o on only 118 records was recieving timeout errors:

- 107 (90.5%) RELEVANT
- 11 (9.5%) PARTLY_RELEVANT

The difference is minimal, so we opted for gpt-4o-mini.

## Monitoring

We use Grafana for monitoring the application. 

It's accessible at [localhost:3000](http://localhost:3000):

- Login: "admin"
- Password: "admin"

### Dashboards

<p align="center">
  <img src="images/dash.png">
</p>

The monitoring dashboard contains several panels:

1. **Last 5 Conversations (Table):** Displays a table showing the five most recent conversations, including details such as the question, answer, relevance, and timestamp. This panel helps monitor recent interactions with users.
2. **+1/-1 (Pie Chart):** A pie chart that visualizes the feedback from users, showing the count of positive (thumbs up) and negative (thumbs down) feedback received. This panel helps track user satisfaction.
3. **Relevancy (Gauge):** A gauge chart representing the relevance of the responses provided during conversations. The chart categorizes relevance and indicates thresholds using different colors to highlight varying levels of response quality.
4. **OpenAI Cost (Time Series):** A time series line chart depicting the cost associated with OpenAI usage over time. This panel helps monitor and analyze the expenditure linked to the AI model's usage.
5. **Tokens (Time Series):** Another time series chart that tracks the number of tokens used in conversations over time. This helps to understand the usage patterns and the volume of data processed.
6. **Model Used (Bar Chart):** A bar chart displaying the count of conversations based on the different models used. This panel provides insights into which AI models are most frequently used.
7. **Response Time (Time Series):** A time series chart showing the response time of conversations over time. This panel is useful for identifying performance issues and ensuring the system's responsiveness.

### Setting up Grafana

All Grafana configurations are in the [`grafana`](grafana/) folder:

- [`init.py`](grafana/init.py) - for initializing the datasource and the dashboard.
- [`dashboard.json`](grafana/dashboard.json) - the actual dashboard (taken from LLM Zoomcamp without changes).

To initialize the dashboard, first ensure Grafana is
running (it starts automatically when you do `docker-compose up`).

Then run:

```bash
pipenv shell

cd grafana

# make sure the POSTGRES_HOST variable is not overwritten 
env | grep POSTGRES_HOST

python init.py
```

Then go to [localhost:3000](http://localhost:3000):

- Login: "admin"
- Password: "admin"

When prompted, keep "admin" as the new password.

## Background

Here we provide background on some tech not used in the course and links for further reading.

### Flask

We use Flask for creating the API interface for our application. It's a web application framework for Python: we can easily create an endpoint for asking questions and use web clients (like curl or requests) for communicating with it.

In our case, we can send questions to `http://localhost:5001/question`.

For more information, visit the [official Flask documentation](https://flask.palletsprojects.com/).