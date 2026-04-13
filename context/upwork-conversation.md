# Upwork Conversation — Eli Doueri
Date range: Dec 14, 2025 – Jan 26, 2026
Status: Superseded by Feb 2, 2026 discovery call. Original scope (SMS funnel on AutoRaptor) evolved into full CRM replacement.

---

Kaleel Lawrence-Boxx
9:32 PM
https://www.loom.com/share/777f5cb294ed4daabf0f540376029392

Hey — confident I'm a strong fit for the task of building out your AI-powered lead funnel and work on problems like this all the time. Just recorded a short 2 min video walking through how I'd approach your specific use case: https://www.loom.com/share/777f5cb294ed4daabf0f540376029392

I've built automation systems in real operational environments — including engineering and construction teams, such as Enbridge — where reliability and edge cases actually matter.
A little bit about me: although I'm newer to Upwork, I'm an AI developer and former Enbridge project coordinator with hands-on experience building production-grade automations using Power Automate, Make, GPT, and Node.

---

Eli Doueri
9:32 PM
Hi — thanks for taking the time to record the Loom and walk through your approach. I appreciate the clarity and the effort you put into it.

I have a couple of quick questions before moving forward:
1. Can you explain how the 30-day follow-up works when a lead goes silent after the initial interaction?
2. Are Meta leads and website leads handled differently in terms of first message and flow?
3. How do you design the AI behavior and tone?

For us, it's important that the AI is fluent, fast, and natural — not robotic. It should be able to qualify, move the conversation forward, and book an appointment or hand off to a human when appropriate, not just answer questions.

Lastly, can you confirm that I'll have full ownership of all accounts and workflows, and that a recorded walkthrough will be provided at delivery?

Thanks again

---

Monday, Dec 15, 2025

Kaleel Lawrence-Boxx
9:56 AM
Hey Eli, I hope you're doing well.

1. 30-day follow up
Every lead will have two field dates: "last_interaction_date", and "next_followup_date" (for example). These are date-based, not timer-based. When a potential client shows interest, by submitting a form (either through website or engaging with Meta) an Immediate AI SMS is sent and follow-up is scheduled 30 days out. The follow up date is dependent on the most recent interaction.

When a follow up is due, the AI will use a short summary of the last conversation (intent, vehicle interest, etc.) to send a personalized message to the prospect

2. Meta leads vs. Website leads.
Yes, the first message is slightly different. For example, if the meta ad made reference to a particular vehicle, the flow would have access to this context, whereas the website leads will make reference to its form submission. This is all to make the chat seamless for the prospect

3. AI behavior and tone
The ai will be given a 'system prompt' which will be injected into every response automatically, and output rules. It will also be given basic information about the business to handle general inquiries. It is instructed to classify intent (hot/warm/cold) and it will do so using specific output flags, so behavior stays predictable and easy to automate. Like if the person asks "when can i come in"

Yes, You will have full ownership of all accounts and workflows. Yes, I think documentation is super important in any organization. It ensures that information can be evenly distributed amongst people in a company and so that we aren't reinventing the wheel every time we get things done. I will definitely keep a very detailed documentation of how things work with associated videos to go with. Just let me know your preferred system for this, like notion, or Onenote and i will make sure I save things there. or even just PDFs with embedded links. I am very flexible in this regard

---

Eli Doueri
10:44 AM
Thanks for the detailed explanation — I like where this is going.

The fact that you're Canada-based is a big plus for me in terms of market context.

We're currently using Raptor CRM, so this needs to integrate cleanly without rebuilding the CRM.

A few final points before we proceed:

- What's the realistic delivery timeline and milestone breakdown?
- What access or assets do you need from me on Day 1?
- How plug-and-play will this be post-delivery (pausing flows, adjusting timing, tweaking AI tone)?
- What documentation and walkthrough will be included so I can manage this confidently as a beginner?
- How do we test the system safely before going live?

One thing I want to be transparent about: I'm new to systems like this.
It's important that the AI's sales tone, conversation flow, and qualification logic are clearly explained and adjustable, so I understand how it behaves and can manage it over time without touching the technical side.

Once aligned on this, I'm ready to move forward.

---

Kaleel Lawrence-Boxx
11:01 AM
Hey, no problem. Yeah I try to be as clear as possible.

Delivery time: 2 weeks
Milestones:
Day 1-2: access setup + confirm CRM fields
Day 3-6: Building core Make.com workflows (lead capture, instant SMS, intent detection).
Day 7-9: 30-day follow-up logic, hot lead alerts, inventory aware responses
Day 10-12: Testing, edge cases, refinements to AI and tone
Day 13-14: Final QA, documentation creation recorded walkthroughs

What I need:
- Access to Make.com, Twilio, and Raptor CRM (or test credentials)
- Example lead form / Meta lead sample
- Inventory source (sheet or feed)

Post delivery: everything will be designed so you can pause or resume flows, adjust flow timing as you see fit, edit the AI tone if you so choose and toggle alerts. You won't have to touch technical logic. There will also be notes appended to make things very intuitive.

Testing: we'll run everything in a safe test mode before going live. Test leads and sandbox workflows with detailed outcomes for your reference all before going live.

Documentation & walkthrough: step-by-step PDF notes written and loom videos to accompany everything and explain the system. Written notes and videos will go hand and hand.

Yes, I will make sure that you understand how the system works completely, so that you will own the system completely once the job is done. This will be one of my deliverables.

---

Eli Doueri
12:22 PM
I'm just confirming with my crm compagnie how this will work because they wanna sell me there own chat bot but I wanna own mine. Once I get a clear answer how we can get in I'll message you and confirm the next step

---

Kaleel Lawrence-Boxx
2:28 PM
Also, just wanted to clarify on my end. What I'm building won't interfere with or replace any existing chatbots on their end.

The system runs independently (SMS + automation) and just integrates with the CRM to acquire lead data and updates.

---

Eli Doueri
2:29 PM
But where I bug it's that I need to put it with the crm or data goes in the crm it's important for the salesman

---

Kaleel Lawrence-Boxx
2:38 PM
Right, I completely understand. If the sales team is using the CRM to do their work, things should stay consistent. I'd build and work in a 'sandbox' (duplicate version), then connect it to the live CRM once everything has been validated. This way the work your sales team does is not interrupted.

Super real concern, and I'd make sure I'm not doing anything to impede ongoing production, while we are building this upgrade!

---

Eli Doueri
2:43 PM
Yes I'll keep you posted even if I have an api anything they can let me connect and I'll get back to you. To be honest I only messaged you out of the 20 candidates. And I like what I see so we just have to make sure we can make it work properly and I'll get back to you on how we can be working it

---

Wednesday, Dec 17, 2025

Eli Doueri
4:45 PM
Hey Kaleel here is where we at with that compagnie. It's called auto raptor. Do you deal with any crm? And that's what they replied to me

[AutoRaptor's reply to Eli:]
Thanks for providing all the details and again, sorry for the delay! I have been chatting with the team.

We unfortunately do not currently have any form of API support for getting information to sync with an outside platform but after reading through what you have laid out, I feel like our AI may be able to solve a lot of these thoughts.
- AI can handle leads from different sources differently
- AI can respond and engage immediately
- AI can have the context on the leads based on where they came from, what vehicle they inquired about and through our disposition tool (Which allows key words to show intent), it can respond and adjust status accordingly.
- If the third party tool is planned to engage with the leads when they land and then have them sent back to AutoRaptor, there would be an option to have the leads go to that tool first and then have them sent back to your account in AutoRaptor but we would lose the context once they come over and not have the visibility while they are being worked.

I truly feel like getting the AI setup for your account will do the trick here.

---

Kaleel Lawrence-Boxx
5:30 PM
Hey Eli, thanks for the update on this. Don't worry about the lack of API, that's actually common in the auto industry.

For dealer CRMs we will use ADF (Auto-lead Data Format), which is the standard for CRMs.

In our setup, the AI runs via Twilio, and after meaningful interactions (reply received, intent detected, appointment requested, etc.) the system will send structured updates into AutoRaptor. Sending things like buyer intent (cold/warm/hot), vehicle interest, last meaningful message, and recommended next steps.

The full SMS transcript stays in Twilio as the system of record, while AutoRaptor stays clean and usable for sales, showing only the info reps need to act quick. This actually makes your salesmen more efficient. Instead of your sales reps having to parse long message threads, they see AI-generated summaries and clear handoff signals inside the CRM.

One thing I want to emphasize is that this approach is designed specifically to preserve your sales team's workflow, not disrupt it. AutoRaptor remains the place where reps see lead status, intent, and next actions, while the AI handles first-touch and qualification in the background.

Before anything goes live, we would also validate this end-to-end with test leads, so you can see exactly how updates appear inside AutoRaptor and confirm it feels right for your team.

Once you get confirmation from AutoRaptor on their preferred ADF / lead-update method, I can lock the architecture and we can move forward cleanly.

---

Friday, Dec 19, 2025

Kaleel Lawrence-Boxx
10:08 AM
Hey Eli, If you're willing, I think it'd be a great idea to set up a call to arrest any other questions. What time works better for you, morning or afternoon?

---

Sunday, Jan 18, 2026

Eli Doueri
11:16 AM
Hey kaleel how are you sorry I was away on vacation I'm back Monday to work I'll talk to you more then

---

Monday, Jan 26, 2026

Eli Doueri
1:26 PM
5148230027 CALL ME WHEN YOU CAN

Kaleel Lawrence-Boxx
1:44 PM
Awesome, thanks for that. Will do

Hey Eli, just left you a message. I'll keep my phone nearby in case you want to give me a shout back

Number is 647-632-1709
