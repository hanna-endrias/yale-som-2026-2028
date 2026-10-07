## Problem 1
- set up the file structure based on this image. the files should all be empty to start. I also want to create an virtual environment to run the code in.
- can you add to AI_Prompts.md to mirror the AI_Prompts.md file in hw 3. I specifically want you to create headers for problems 1 to 13 but I will later fill in the content.

## Problem 2
- For problem 2  i need to look at the database and see the fields of each table. how do i do that?
- is there sqlite viewer extension for claude code? if not can you format the option 1 output more nicely?

## Problem 3
- this is my prompt how can it be improved "I want to build the frontend for the Campus Customs website. Place a nave bar that has the following elements: Home, Products, About Us, Log in, Create Account". I will fill the content for home and about us pages so put a temporary lori ipsum text for now. On  the products page, show product iamges from the catalogue by usign the image paths in the database. Show product basic info like name, price, short description. Do not make up information. If something is missing let me know. Make each product open a single-item page - a laarge image on one side, full product text on the other like description,p rice, sizes/stock when avaialbe). Clicking on a card on prodcuts should take a shoper there. There will be a chat interface at the bottom right of the site (a floating chat panel is fine). The agent does not need to talk yet. It can just be a stub for now. Let;s start with a simple FAstapi app in the backend/main.py to serve the products and images. I will explan the experience in future iterations. Ask any clarifying questions. Aim for accuracy. "

## Problem 4
- how can my prompt be improved? "Now we're building the create account and login flow. For creating an account, the fields should be first name, last name,  email, password, and confirm password. For Login, it should have email and password. The new accounts should go into the users table. Make sure to hash and salt the passwords when they get added.  When you finish explain how wthe auth process works in our chat."

- what are common and important password protection options? I'm debating adding them

## Problem 5
- how can my prompt be improved? "okay now we are working on the pydanticAI agent backend. 

The pydanticAI agent operates behind the FastAPI and enables the chat widget experience. The api app will be in backend/main.py. The agent will be representeed in these four files:

backend/prompts/prompt.md - system prompt
backend/agent.py - agent entry/writing
backedn/tools.py - tools the agent can calll
backend/models.py - Pydantic/ Pydantic AI structured types

main.py will expose a chat route so a message from the website returns a reply from the agent and pulls the appropriate details to respond like products/auth. Use my portkey ai details in my .env file to use openai luna 5.6 model for the responses to start. 

I will provide the voice and safety details in prompts/prompt.md. Update types in models.py for chat replies/prodcut cards as needed.

The backend runs from the backend/ folder with this command: uvicorn main:app --reload --port 8000
"

## Problem 6
- "hwo can y prompt for problem 6 be improved "
for the enxt problem we are adding a tool. The agent should have tools to look up information from campus_customs.db:

* product description
* price
* how many are in stock (by size when the custoemr asks)


The agent should never invent prices or quantities and use the database. If a size is out of stock, say so clearly.

Exapand prompts/prompt.md so the agent knows to call these tools for price and stock questions. Add or update return types in models.py.

in the end output to our chat each tool, explain which model fields use dto lookup results and why"
"
- "what are the tradeoff on breaking up the tool into multiple parts vs one large tool if I am using a cheaper/simpler model?"

## Problem 7
- "how can my prompt for probelm 7 be improved "We are addign a new feature to the site. When a customer asks about a type of item, the agent should search the catalogue and wesbiste should show those matching items as product cards (image, name, price, short info). This is an API contract: the agent returns structured product matches and then the front end renders them on the website. After the dynamic product cards are loaded by your new feature, make sure the same single-item page behavior you built in Problem 3 still works: each product card — including the ones the chat just put on the page — should still open that detail view when clicked."
  
- "is important to include implementation details in the prompt? what would be the benefits?"

## Problem 8
- "how can my prompt for problem 8 be improved? User chat history should be saved in the database and reload when they return. The agent should knwo who is chatting (name and email). Decide whether it should go in agent deps or tools teh agent can call. Also provide the agent with enoughc page context that the agent can answer questions like "do you have this in pink? Feel free to put code into the agent context if that helps. Guests can still chat, but history is only persisted for logged-in users. "

- "the changes to maintain customer memory caused the the agent to stop using the chat search to update the page?"

## Problem 9
- "is there a way to make the page update based on chat interaction collapsible? (like press plus and then minus to see that card)? I am open to toher visual varaitions too"
- "why did the white sweater show up in the results? how can i impove the agents?"

## Problem 10
- "I want the website to have a whimsical feel but honor the yale color aesthetics. Let's discuss the options before you implement. I want to design to encourage customers to stick around and buy"
- "I like b but I'm curiosu about what if the backround was blue and text was white"

## Problem 11
- "can you provide inventory level for the hype and vice yale university premium crewneck in our chat?"
- "what is the price for that items as well?"

## Problem 12
- "I'm working on problem 12 how can my prompt be improved? "Keep an append-only output/audit_trail.json of agent-loop activity (time, tool name, short args/result, stop reason). Do not wipe it between runs. Also, think of some safety rules to give the agent and put them in prompts/prompt.md."

## Problem 13
- "outside of .env what files should be in in .gitignore?"
- "update README.md to explain how to run the front end and back end after placing the data pack (the data folder)"
