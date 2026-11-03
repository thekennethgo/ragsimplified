# RAG vs fine-tuning vs long context

Three ways to make a language model use knowledge it did not learn in training, and when each one fits.

## The three approaches in one line each

- **Retrieval-augmented generation (RAG):** search your documents for the passages that match the question and give only those to the model with the question.
- **Fine-tuning:** train the model further on your own examples, so the knowledge or behaviour becomes part of the model's weights.
- **Long context:** paste whole documents into the prompt and let the model read all of it at once.

## Retrieval-augmented generation (RAG)

RAG keeps the knowledge outside the model, in a searchable library. Adding or changing a document only means indexing it again; the model itself never changes.

Strengths: answers can cite the exact passage they came from, so they can be checked. Knowledge stays current, because updating a document updates the answers. It scales to libraries far larger than any prompt, and each question only pays for the few passages it uses.

Weaknesses: the answer is only as good as the search. If retrieval misses the right passage, the model cannot use it, and questions that need the whole library at once, such as "summarise every document", fit it poorly.

## Fine-tuning

Fine-tuning changes the model by training it on examples, such as question-and-answer pairs in your domain.

Strengths: it is good at teaching a style, a format, a tone or a specialised task, such as always replying in a set structure or using a field's vocabulary. The prompt stays short, because the behaviour is built in.

Weaknesses: it is a poor way to store facts. The model may still mix them up or make things up, and it cannot say which source a fact came from. Every change to the knowledge needs another round of training, and training needs good data, compute and care.

## Long context

Modern models can read hundreds of thousands of tokens in one prompt, so for a small set of documents it is possible to send all of them with every question.

Strengths: nothing to build or index, and the model sees everything, so it can compare or summarise across documents.

Weaknesses: every question pays to send every document, which is slower and more expensive. Models tend to use information in the middle of a very long prompt less reliably than information near the start or end. And it stops working once the documents no longer fit.

## How to choose

- The knowledge changes often, the library is large, or answers must be cited: use RAG.
- The model needs a new style, format or skill rather than new facts: use fine-tuning.
- There are only a few documents and each question needs all of them: use long context.

They also combine. A fine-tuned model can still answer with RAG, and RAG can pass a generous amount of context when the model allows it.

## What this app uses

This app uses RAG. The library is many documents on different shelves, it changes whenever the owner adds a file, and every answer shows clickable citations to the passages it used, which only RAG gives directly. The model is not fine-tuned: it is a general model instructed to answer only from the retrieved passages and to say so when they do not hold the answer.
