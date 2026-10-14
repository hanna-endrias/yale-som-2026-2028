## Problem 1  Vibe coder prompts
- set up the file structure based on this image. the files should all be empty to start. I also want to create an virtual environment to run the code in.

  Only one prompt was needed to set up the assignment: this prompt created the full folder structure and the virtual environment.

## Problem 2 Study the Campus Customs database
- copy the contents of campus_customs.db to campus_customs_new.db. Show me the contents of campus_customs.db in our chat.
- Can you output all the tables in the db in our chat?

  *Why the follow-up:* the first answer mixed the data with commentary on what it meant for the tickets. I wanted every table shown in full, with its fields, types, and keys, so I could study the raw data myself before building anything.

## Problem 3 Build the MCP server 
- how can my prompt for creating the mcp server be improved? "write an mcp server  in mcp_server/ using FastMCP. It will talk to data/campus_customs_new.db. You do not need to connect or run it in this problem. Every agent will use the tools in this mcp server. We will start with three  tools needed for tickets in the database. Keep names clear, never invent any data, and use information in the database. In our chat, list the three mcp tools, the tables it reads, and which ticket it helps unlock, why that tool is the righ tone for that ticket. Add a readm.md file as well that explain what the mcp server is for, which database file is used, adn the three tools it has "
- I'm trying a different prompt. how can my new prompt be improved?

  " Goal: Write an MCP server in mcp_server/server.py using FastMCP. 
  Input: data/campus_customs_new.db
  Success: Write three tools that will address the blocks for each of the three tickets. 
  Limitations: Never invent data. Stick to information in the database. Keep the names clear.

  In our chat, for every MCP tool, explain:

  * which table it reads
  * which ticket it helsp unlock
  * one sentence explaing why that tool is the right one for that ticket

  Create a short README file that explains:

  * purpose of the mcp server
  * which databasefile it uses 
  * the three tools it has 
  "

  *Why the follow-up:* my first prompt was loosely written. After getting feedback on it, I rewrote it in a Goal / Input / Success / Limitations format and asked for another review before anything was built.

## Problem 4  Add the MCP server to vibe coder and test each tool
- Add this MCP server to this project so Claude can call the tools. Save the connection JSON text in .mcp.json at the project root (or however Claude saves local mcp server lists). After connecting, test each of the three mcp tools. save the evidence in output/mcp_smoke.json. For each tool include:

  * the prompt you asked the vibe coder
  * the tool name
  * the tool output (must match values in data/campus_customs_new.db)
- i started a session in a new tab

  *Why the follow-up:* Claude Code only loads `.mcp.json` when a session starts, so this session couldn't call the new MCP tools. I opened a new tab so the vibe coder could actually use them, then came back to report it.
- i stored the evidence in mcp-interactions-evidence.md can you check that it pulled the right information from the database. Were its answers correct?

  *Why the follow-up:* the tool tests ran in the other tab, so I saved that transcript and asked this session to check every value against the database before turning it into `output/mcp_smoke.json`.

## Problem 5 Build the agent team and grow the MCP tools
- Moving on to problem 5. Add the chat engagements for problem 4 to AI_Prompt.md based on our previous approach.

  Build the agentic team for Campus Customs using PydanticAI: Boss, Inventory, Accountin, Facilities, and Customer Service. Include prompts, models, and agent loops so they can delegate work to each other with full connectivity. 

  Put the agent prompts in backend/prompts/ - one file per agent. Put data types in backend/models.py, and the agent files under backend/(your layout can vary as long as the five roles are clear). Use your PORTKEY_API_KEY and only gpt-6-luna for every agent.

  Help me write detailed prompts to decide the shop rules that the agents need. The goal is more detailed prompts that cover all aspects of an agent and not a short generic prompt.

  Add any tools the agent needs to the MCP server so they can work on the open tickets. Shop facts come from the MCP server over data/campus_customs_new.db -- do not invent a second shop-tools layer that bypasses MCP.

  Wire the agents so they append to output/audit_trail.json as they run: for each agent-loop step, record enough to audit later. Append to this file -- do not wipe it each run.

  In output/harness.md, list each agent and each MCP tool (including ones you add in this problem) along with which table the tool uses. Also add  a short safety section: the guardrails a real business would want when agents touch real customers and real money, plus limits that keep token use in check.

  Update mcp_server/README.md so the tool list matches what you have now.
- can you jsut create the .env file and i fill it in

  *Why the follow-up:* running the agents needed my `PORTKEY_API_KEY`, and hw5 had no `.env` file yet. I asked for an empty one so I could add my key myself without sharing it in the chat.
- can you alos provide context for each ticket as well relevant tot he decisions?

  *Why the follow-up:* to set the shop rules (the discount policy and which bill gets paid first), I needed to see how each option would play out on the three real tickets before choosing.

## Problem 6 Plan the three tickets
- Before wiring the backend, we are creating an html page to capture what I anticipate will happen. Build output/desk_tickets.html - a page you can double-click with one tab per ticket (101,102,103). Also add empty Cash and Reflection tabs for later problems (leave them blank or with a short coming later note).

  On each ticket tab, fill an Expected section (leave room for an Actual section that will be filled after the agents have run). 

  For each ticket's expected section, we will need to answer:

  * who the boss should call first and why
  * all the agent delegatiosn you expect - not boss calls everyone
  * which mcp tools i expect that run to use

  Plans that send every specialist on every ticket score low.  We will compare this plan to what actually happens when the agents resolve the three tickets. 

  Let' s discuss each scenario until i land on an outcome.
- are decision 1 and 2 related? which ticket ar ethe decisions tied to?

  *Why the follow-up:* the options for ticket 101 came as three separate questions. I needed to understand how the delegation order and the reprint decision affected each other, and which ticket they belonged to, before deciding.
- decision 1: inventory first then accoutning, decision 2: flag a human and then pay #501, decision 3: mention the alternative

  *Why the follow-up:* with that context, I gave my decisions for ticket 101. The same discussion then continued for tickets 102 and 103 until each plan was settled.

## Problem 7 Backend routes
- update AI_prompts.md for problem 6

  Moving onto problem 7
  The react frontend dashboard for problem 8 needs a backend it can call. in backend/main.py use FastAPI and add routes that do the following:

  * return the three tickets and whether each is open or resolved
  * take a ticket id and run your agent team on that ticket
  * return recent agent events - what each agent said and which tools they used - so the board can refresh
  * approve a payment or purchase after a human clicks approve (agents only prepare the pay; this route is what actually changes cash)
  * return the current checking balance from cash_accoutns
  * reset the database to the original values when you want to try a fresh run

  From the backend/folder start the server with:
  uvicorn main:app --reload --port 8000

  This turns on your backend at http://localhost:8000 so the frontend dashboard can call those routes.

  In output/harness.md, list each route in one line (what URL/what it does)

## Problem 8 Agent dashboard 
- update AI_prompts.md for problem 7

  Moving onto problem 8 
  Build the frontend dashboard in frontend/ with react+vite+typescript. The page should call the routes you built in problem 7. at minimum the board should:

  * list all three tickets
  * let you pick one ticket and start the agent team on it
  * show each agent and what they are saying/doing while the ticket runs
  * mark a ticket resolved when the run finishes
  * show a short summary of what each agent did on that ticket
  * let a human approve a pay or purchase when asked
  * show the checking balance (it should drop after an approval pay)

  The dashboard needs to look good. Let's discuss potential design options.

  The frontend should talk to the backend at http://localhost:8000. On the backend, allow the Vite page origin (usually http://localhost:5173) so the browser is allowed to call those routes. Start the board with:
  npm run dev

  this opens the react desk in the browser so i can pick tickets and watch agents. Write output/design.md with our design decisions (layout, how agents read differently, how resolved tickets and cash show up) and why including the creative choices that make the  dashboard special/enjoyable.
- let's honor the rule and two stage

  *Why the follow-up:* the assignment says to mark a ticket resolved when the run finishes, but that conflicts with the Problem 5 safety rule that a ticket is never resolved while a payment is still waiting on a human. After weighing both, I chose to keep the rule and use two-stage resolution.
- can you run the frontend and backend

  *Why the follow-up:* once the board was built, I wanted the backend and the dashboard both running so I could open it and use it.

## Problem 9 Resolve the tickets
- update AI_prompts.md for problem 8

  how di you know problem 9 would reset the database?

  but here is problem 9
  before testing the agents on a full run over the three tickets, reset the working database data/campus_customs_new.db again so i can start clean. note the starting checking balance. then run all three tickets onthe board (101,102,103) until each is resolved.

  Open output/desk_tickets.html from problem 6. on each ticket tab, fill the actual section from this run: which agent worked, what they delegated, and which tools they used. keep your expectation section so we can compare.

  On the cash tab of the same output/desk_tickets.html, itemize the money:

  * starting checking balance (after the reset)
  * for each ticket: how cash changed when that ticket resolved and why (which pay/purchase,dollar amount)
  * ending checking balance - it must match cash_accounts in the working database

  Wrong cash math is bad even if the board shows every ticket resolved. Also save:

  * output/resolved_tickets.json - for each ticket: id, final status, short outcome, what each agent contributed, and any human approvals
  * output/resolved_board.html - a page you can double-click with a screenshot of the react board for each resolved ticket (101,102,103)

  Append real runs to output/audit_trail.json. Finsih output/harness.md so it covers tables, Mcp tools, the five agents, api routes, the dashboard, and safety rules.
- I made the approval decisions

  *Why the follow-up:* no agent can approve money, so the run stopped at the human step. I approved the three payment requests on the dashboard, then asked for the cash to be checked against the database and the outputs finished.
- is there a way to make the desk_tickets.html easier to understand? the page feels overwhelming  now

  *Why the follow-up:* once the Actual sections and the Cash tab were filled in, `desk_tickets.html` felt overwhelming, so I asked for a layout that's easier to compare. That became the scorecard version.

## Problem 10 Reflection 
- let's put my reflections in the reflection tab of output/desk_tickets.html. My answers need to be detailed and thorough.

  * how do i evaluate the performance of the agents on each ticket and why?
  * for each ticket, how did actual comapre to the expected plan i wrote earlier?
  * what would have been simpler as one agent with tools and why?
  * describe 3 new problems campus customs might face that this agent team could solve with the tools you built
  * describe three new problems campus customs might face that this agent team could not solve with the tools you built, and explain the tools and agents you would need to solve them

  every answer needs to be tied to this app and the three tickets i ran. I need to use the ticekt tabs and cash tab on the same page as my evidence.
- can the styling be conssitent between the campus custom page and the .html pages. I want the html pages to mirror the styling of the cmapus custom platform

  *Why the follow-up:* the HTML pages looked different from the React dashboard, and I wanted all my deliverables to share one consistent design.
- let's go through each question and discuss and then post the reflection

  *Why the follow-up:* the first reflection was drafted for me. I wanted to go through each question and add my own judgment (adding customer experience, preferring caution on 103, a checklist plus a manager's verdict, and different "could not solve" problems) before posting the final version.

## Problem 11 Submit to GitHub
- the fodler structure should look like this [image of the target hw5 folder structure] can you remove any excessive files/folders? keep the .env file and any folder/files related to virtual environment for now though
- the frontend folder is fine and write it now

  *Why the follow-up:* after the cleanup, I confirmed the frontend folder could stay as it is, since it holds the React board, and asked for the README to be written next.
