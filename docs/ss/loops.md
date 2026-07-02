
0:21
at Anthropic. Um and the kind of topic for this session was uh inspired by a
0:26
blog post we put out uh just a couple weeks ago actually um about how to think
0:32
about building uh agents that can actually run for really long extended
0:38
periods of time. You know you're talking five six hour plus kind of runs. Uh, I think we've all seen these kind of
0:44
demos, you know, of like companies being like, hey, we've like oneshotted a browser, for example, but not
0:50
necessarily sharing like some of the details into what goes into the harness. And that's what we kind of want to talk
0:55
about today. So, the first half, um, my amazing colleague Andrew will talk about
1:01
a little bit about basically how we've got here, some of the primitive that we've shipped in called code, um, and,
1:07
you know, where we are today. Um, and then I'll hop back on stage to talk a little bit about um, some of the more
1:13
experimental stuff that we're playing with with harnesses um, as well as, you know, a few examples of of what we've
1:19
seen. But over to you. Sounds good. Thank you, Ash. And yeah, thanks everyone for joining uh, first
Overview of long-running agents
1:25
session of the AI engineer conference. So glad you're spending it with us. Uh, my name is Andrew. I'm on the applied AI
1:32
team based out of London working as a solution architect with a lot of our digital native and industries customers.
1:38
So, um, yeah, I'm going to give a little bit of a history tour, uh, trip down memory lane, but really with the focus
1:44
on all the things that we've shipped that lead to agents being able to run, uh, for multiple hours or even days at a
1:50
time. Um, and then I'll hand over to Ash to do more of the the state-of-the-art, right? Okay. So, um, little quote from
1:58
or on Twitter from Boris, the creator of Claude Code. This was on the one-year anniversary of Claude Code. uh basically
2:04
saying a year ago cloud was struggling just to write bash commands and escaping strings um and it could run for you know
2:11
maybe 20 minutes at a time and then we're now at the point where almost all of cloud code is being written by cloud
2:16
code and it can run effectively for days at a time. Uh so sort of a a big a big
2:22
swing over just the course of a year and I'll walk through that history uh a little bit now. But just to maybe I'll
Challenges: Context, Planning, and Judgment
2:29
zoom in here. Um just to sort of frame the problem up like why why is it that
2:35
it's really difficult for these agents to run for extended periods of time. Um I think broadly there's three big
2:41
buckets. Uh some are more intuitive than others. So firstly context. I think we all understand context windows very much
2:47
finite. So you start a new session, there's like amnesia. The agent has to start from scratch. So you need some
2:52
sort of memory component. Um, also as you're working through a context window, there's this notion of context rot. So
2:59
there's less coherence as you're you're getting deeper into that session. Uh, also you might get to the point where uh
3:06
the model actually exhibits what's called context anxiety. So it gets kind of nervous as it reaches the end of its
3:12
context window and it just quickly hurries up to finish what it's doing. Um, this kind of leads into planning. So
3:18
uh in general models are not that great at planning just out of the box. Uh they might try and do everything in just one
3:24
shot or for example they might build half a feature and then stop or they might just run out of context altogether
3:31
and sort of leave a half-finished app built. Um but then maybe less intuitively um models are really bad at
3:38
judging their own output. So I know we all know that models can be sickopantic and sort of tell you what you want to
3:44
hear but this applies as well to to coding tasks. So it might look at a feature and see that it's sort of half
3:50
halfbaked or a little bit implemented and say yeah okay uh that looks done and then it'll move on to the next thing or
3:55
it might build a feature like a button but actually the back end you know doesn't exist for it. There's sort of no
4:01
nothing behind that but it looks like the feature is done. So um I know Ash will talk quite extensively of some of
4:07
the new techniques we have to to help with this um specifically so models can become better at judging their own
4:13
output. So there's there's two ways really we can we can fix these things. Uh the
Two approaches: Model updates vs. Harness evolution
4:19
first one is obviously the model. So u baking it all into the model weights themselves. And I'm sure you've all seen
4:25
this this meter chart. It's basically how long can an agent run for with a minimal scaffold uh where it's
4:32
completing 50% of the tasks. And you'll see from opus 3.7 it's around 1 hour and
4:38
up to opus 4.6 one year later it's at 12 hours. So an entire day. Um and we've of
4:44
course you know managed to get that running much longer. Other people have as well but this is just a sort of a very minimal scaffold.
4:51
The second thing that you can do is of course make changes to the harness itself. So this is the scaffolding um
4:57
around the model and we have the agent SDK which ships with all the primitives
5:03
that we've been building over time. So there's the core agent loop itself where you have clawed model that's determining
5:10
what to do, what tools to run. Uh maybe it's pulling in some tools from MCP servers. Uh it might delegate some tasks
5:17
to a sub agent. It's bringing in all the context from things like claw.md or the skills that are loaded or slashcomands.
5:23
There's a whole permission system. And th this this will change over time as well as the models get better and
5:28
improve. But these are sort of the the core primitives that we're working with. And then of course you use this framework to to build your own harness
5:35
for whatever it is you're trying to do such as some of the things that Ash will show uh later on when we get into more
5:41
longunning agents. Uh I think what's also interesting is just looking back at
5:46
the last year of releases is that when we've released a model, we've always also released a lot of harness changes
5:53
alongside the models. So really these things are like co co-evolving together. So we'll just look back um I suppose
Prehistory: Sonnet 3.5, Computer Use, and MCP
5:59
firstly just prehistory um beyond you know one year ago. I think we all remember that that period where claude
6:06
had the artifact section of claude.ai and and sonnet 3.5 was the first model
6:11
that really showed promise when it came to coding and it could now verify that it could look at what it had built and
6:17
sort of iterate from there and that was quite an aha moment sort of pre-clawed code. Uh but then also we shipped
6:24
computer use so it could start clicking around taking screenshots um testing its own code as well as MCP spec uh which
6:31
enabled it to sort of use tools. So then getting into cloud code. Uh this is February 2025. So this is about just
The evolution of Claude Code
6:38
over a year ago. Um Sonnet 3.7 was released and sort of state-of-the-art on
6:44
Swebench and Claude Code was released in research preview. And I think an an interesting quote that I pulled from
6:50
this release actually is that the goal of Claude code was to better understand how developers use claude for coding to
6:56
inform future model improvements. So essentially when we released claude code the whole idea was for it to be somewhat
7:03
experimental to inform how we actually improve the base model itself. And you'll see this trend that over time the
7:09
models become better uh the harness certain aspects of it might become less necessary or it will evolve.
7:16
Um just just in terms of uh these slides as well in the bottom left corner these are some of the things that are sort of
7:22
the focus of these releases whether it's uh context or planning uh or verification and then some some stats
7:29
but I'm not going to sort of read everything. Um so yeah next this was around May time of last year Opus 4 and
7:36
Sonnet 4 were released and just in general um these tools got much better at sort of managing their own context
7:42
and getting to task completion uh without reward hacking or anything like that and then uh cloud code became GA as
7:49
well and we released the cloud code SDK so sort of the the harness powering claude code
The Ralph loop technique
7:56
um little interlude here from the timeline I think everybody now knows about this Ralph Wigum technique
8:01
You might not know that it was actually last July that this was that this came out uh when when Jeffrey Huntley
8:08
initially released the paper because it really sort of gained a lot of traction around say December or so of last year
8:14
uh when for example people started playing around with it themselves. Claude also released our own uh Ralph
8:20
loop within the the Claude code uh harness itself. But essentially it's it's quite sort of a simple technique
8:26
that you're just taking a prompt and you're feeding it into cloud code CLI for example and then you're just running
8:33
that on a loop until uh all the tasks are complete. It's a little bit deeper than that. I I think people tend to
8:39
simplify it. There's actually a few phases where it first, you know, would have some kind of planning where it
8:44
breaks down that prompt into a few different features and then it would pick sort of one task from that and
8:50
start a new session and then work with a fresh context window. So a lot of those concepts were were applied in the real
8:56
flute but I think um why it caught so much attention is because it sort of seems really simplistic and he put it uh
9:02
deterministically bad in an undeterministic world. So the idea being that it's better to fail predictably
9:08
than it is to succeed unpredictably. Um when we actually created our own plug-in
9:14
for this in cloud code you'll see well I don't know if people can recognize what what the major difference is. There's
9:20
some people say, you know, that's not a real rail loop. Um the idea is that this is just running within a single cloud
9:26
code session. So it's not creating a fresh context window. It's just relying on compaction to happen over time. So
9:32
you know, maybe it's not considered sort of a real RA loop, but you'd set the max iterations. You'd set a a safe word, and
9:39
then essentially a stop hook would intercept when claude would typically stop, and if it's not finished, it would
9:45
just sort of continue until it hits one of those exit criteria. Okay, so on to uh sonnet 4.5. This was
Sonnet 4.5, Agent SDK, and checkpoints
9:54
when the model just generally started getting better again at handling its own context. So this is when became more
10:01
context aware tracking how many tokens had been consumed. So as it got towards the end of the context window, it sort
10:07
of understand that and it could manage its own context. Um cloud code 2.0 also
10:13
shipped. This is where we introduced checkpoints. So actually keeping track of of the code over time being able to
10:19
rewind to previous parts of the session. And then we released we just sort of renamed the cloud code SDK to the agent
10:26
SDK and that's because we realized it's much more general purpose than actually just for coding. So you'll see we're
10:33
talking about coding a lot right now but I think what's very interesting is applying these longunning harnesses to
10:38
um other domains as well. Uh at this point we could run for about
10:44
30 hours or so uh with Claude uh Sonet 4.5. But then completing the family with
Opus 4.5 and the role of sub-agents
10:50
Haiku 4.5 and Opus 4.5. This is where it got really interesting because all of a
10:56
sudden running many sub aents became really economical and opus 4.5 became
11:02
really good at planning. So we could start doing things like using opus 4.5 for planning. Um and then using sonnet
11:08
4.5 is the workhorse for really executing all of that code. Um and then there's there's a big couple months as
11:15
well because this is when we release skills which again very good at uh making use effective use of the context
11:21
with this notion of progressive disclosure. So just the front matter of the skill is loaded in instead of sort
11:27
of all of your tool descriptions you know which can consume quite a lot of the context window up front. Um, and
11:33
then sort of the entire rest of the body of the skill is loaded in if it's instantiated followed by say some
11:39
references um to even even code that could run more deterministically. And then more context improvements, things
11:45
like programmatic tool calling. So instead of running a bunch of tools, pulling all of that into context and
11:51
then trying to process it, actually just writing code on the fly and being able to sort of run a series of tool calls
11:57
and then just get the final result back. And again, this is all just to improve the the usage of of the context window.
First long-running agent patterns
12:05
Okay, so a lot going on on this slide, but at this point, um, this is around November time. We released our first
12:12
blog post on longunning agents and and how you go about building these. So a
12:17
lot of the concepts I've already described um should make this fairly easy to understand actually where say a
12:23
human would write something like you know write me a browser or create a slack clone or a Salesforce clone just
12:29
something like really really vague and uh the first thing that would happen um
12:34
in this harness that we built is there's an initializer agent that would take that simple prompt and it would break it
12:40
down into a series of of persistent artifacts. The first being a feature list of say x number of features feature
12:48
list.json because we actually found the models might overwrite markdown files
12:54
whereas they're they're less likely to just overwrite JSON files which is kind of interesting. Um it would also write a
12:59
progress file um of course sort of start the git repo uh build in a nit script
13:05
and then just have a flag for you know whether the features are complete or not if they sort of pass all the tests. Um
13:12
from there it would go into this harness loop where uh there's multiple different steps here. So the first one is you know
13:19
again in a fresh context window just getting the bearings. What's the present working directory? Um what's the the
13:25
progress file say? Okay. And then u doing a smoke test. So running the init script so it didn't have to figure out
13:31
how to do that every time get the server up and running etc. Uh and then picking one feature only one feature that that
13:38
hasn't passed all the tests. um implementing that feature, doing some actual tests, much so verification loop
13:45
much like a human would do using Puppeteer in this case. Um and then if if everything passes, actually writing
13:51
the git commit and um changing the the state of of this particular feature to
13:57
passes and then if there are any features that are unfinished, just continuing that loop in a fresh context
14:02
window. So, we're starting to layer in a lot of these concepts here. Fresh context windows, these sort of
14:08
persistent artifacts, verification loops, um really good planning up front. You'll see like this this is sort of the
14:14
first iteration of of these longunning harnesses here.
Opus 4.6, Agent Teams, and server-side compaction
14:20
Okay. So, uh continue with the history tour. So, then Opus 4.6, Sonnet 4.6. Um
14:26
these models are really great because Sonnet 4.6 6 was basically offering that opus level intelligence more at the the
14:32
set price and it became again like very much a workhorse for a lot of cloud code. Um and Opus 4.6 just became really
14:40
good at planning. We we called it very much an agentic model. So Opus 4.6 was
14:46
great at at deciding like which tools to use and just being able to run for much longer. uh if you recall that meter
14:53
chart you'll see that this was a jump from about four hours up to 12 hours with sort of that very simple harness.
14:59
So this model is like very very agentic. And then along with that um with some of the research we had done we released
15:05
agent teams which the idea being in cloud code this sort of more general purpose way for you to say scaffold out
15:11
your own set set of of custom agents. And the innovation with agent teams is that instead of everything reporting
15:18
back into the main agent um the actual sub agents could could communicate with
15:23
each other. So they sort of had their own way to coordinate and then report back to the main agent only when it was
15:29
required. Um we also introduced serverside compaction which basically meaning that these models can now just
15:35
run indefinitely and compaction could just sort of you know happen on the server side. And then um this 1 million
15:42
context G. So now we have like one big context window. You see like the models are getting better. Maybe you can just
15:47
run a lot you know within a single context window even instead of necessarily needing new sessions all the
15:52
time. You see how things start shifting over time. So that's sort of the uh the
15:58
whole overview. You can see all of the different uh releases that I shared here on this table and you can see how it's
16:05
changed from say sonnet 3.7 at 1 hour uh to 12 hours with opus 4.6 six and then
16:11
we have our own anecdotes as well um where task would take say you know like
16:18
20 minutes when it was Opus 3.5 and now we're building say fullyfledged apps
16:23
that don't have to run for you know 30 hours they can run typically we're seeing like say 3 to five hours you can
16:29
build like a really really fully featured application that that runs out of the box
16:35
so what's really interesting is is the harness doesn't just disappear as the
16:41
models get better. It's really evolving as the models change over time. And it's really fascinating to sort of find the
16:48
the gaps in the model and then fill that in with the harness and then you train the model on um the using that aspect of
16:55
the harness. Then maybe at some point you actually remove that entirely and sort of this iterative uh loop just
17:00
keeps happening over time with with more and more of these sort of co-releases that we have. So, um, yeah, hopefully
17:06
that was interesting little trip, uh, back through the clawed evolution and
17:11
how it applies to the long running agents. And so, I'll I'll hand over to to Ash to continue with where we are
17:17
today, uh, in terms of the state-of-the-art.
State-of-the-art harness patterns
17:28
All right. Um, quick question. Any of you guys have any agents running at the moment in the
17:35
background doing work while you're here? Just one, two, three. Okay,
17:41
probably should be more of you. Um, uh, hopefully by the end of this you'll have some ideas to like take away and
17:46
actually like put into practice. Um, so yeah, that's that's a history. Um,
17:53
and I quite like that quote that uh Andrew talked about where the frontier doesn't really shrink, it just uh moves.
18:01
And so what I want to talk about a little bit is some very simple uh kind
18:07
of harness patterns that we've been playing around with internally that we use to to build these like very fancy
18:12
oneshot demo apps. Um but also you know we're experimenting with this stuff in
18:17
post- training um in in RL how do we make our models and and just the general
18:22
behaviors more adept at uh autonomous work.
18:27
So, if you've ever tried to get um an agent
18:33
to try and review its own PR, um you'll kind of understand uh where this is
18:39
going. So, this general uh idea is shamelessly kind
18:45
of stolen from from GAN's uh genative uh kind of adversarial networks. So you
18:51
have this uh generator kind of model and then you have some sort of discriminator
18:56
um and uh you have some sort of adversarial pressure between them. You know the generator builds the evaluator
19:03
grades um and the whole idea here is we're splitting up you know the context
19:09
windows uh system prompts uh uh the jobs entirely. Right? The evaluator here
19:15
isn't just reading diffs, but it's actually using playright um to open live
19:20
pages, click around, try things out um and then it eventually hands back whatever critique gets decided back to
19:27
the actual generator and you you know you kind of continue that loop. Contrast that with what most people today are
19:33
doing, which is kind of using one claw code session, telling it to check its own work um uh and kind of loop that
19:39
way. So the obvious question for me at least is, you know, if the evaluator is
19:45
also just an LLM, um why doesn't it just rubber stamp it too?
19:50
And so the key idea that we're kind of exploiting here is um yes, the evaluator
19:57
is still uh a large language model and yes, it's still going to be biased towards uh liking large language model
20:03
style outputs. Um, but tuning a standalone critic um to be harsh is
20:10
actually very tractable. But tuning a builder to be somewhat self-critical um is is not. I think a really good analogy
20:18
for this, right, is is same as humans. Um it's very easy for uh me to you know
20:23
critique a lovely piece of artwork or you know a fine meal. Um much harder for me to
20:29
actually go ahead and like you know paint that uh or or cook that meal myself. So what we're doing here is
20:36
exploiting the gap between the ability of an LLM to be kind of a critic uh versus a generator.
20:42
So the next thing I kind of want to talk about is like how do you actually think about designing uh these critics? It's
20:49
very similar to the process of creating good eval but in the context of full stack apps there are a lot of fuzzy kind
20:55
of areas which go into what makes something good. It's not just does it work but does it look good? Does it feel
21:02
good? um is there an element of taste um uh in these kind of products as well?
21:08
So this is where we've been doing a lot of experimental work um especially when trying to you know imbue Claude with
21:14
design taste and post training um but also um you know create these kind of
21:20
front-end design skills that we kind of put out there and just generally improve the the front-end design uh ability of
21:25
of our models. So, the way we think about this is
Evaluating subjective output with rubrics
21:31
most people say you can't grade taste, but you know, we think you can if you
21:37
have a a strong enough opinion on it, and you just kind of write it down. And so, the way we do this at least is with
21:42
kind of creating a rubric with four criteria, uh, design, originality, craft, and functionality. Um, we
21:49
actually weight this towards uh design and originality. Um, we've kind of
21:55
shifted the waitings between these four things uh depending on which model's in play. But at the moment, you know, Opus
22:01
46 is pretty good at at at functionality already. So, the problem that we're trying to overcome is how do we prevent
22:08
things like, you know, purple gradients, general kind of AI slop type aesthetics in general. And we kind of just go ahead
22:16
and calibrate this with a few short examples um on reference sites. So the evaluator's kind of taste converges on
22:22
our own. Um, and let me show you an example I guess of
22:27
what this actually looks like uh kind of in in practice. So
22:32
this is just an example um of a model uh
22:37
going through this similar kind of loop. Generator uh evaluator launches playright navigates screenshots scores
22:44
on those kind of four criteria writes critique and then hands back to generator. So all of these examples are
22:50
just HTML and CSS only um that I've gone through for maybe four hours, 5 to 15
22:55
rounds. Um I think the interesting thing here um which is quite unique and
23:01
something which you wouldn't necessarily get um if you're just using a single kind of agent loop is that the thing
23:07
pivots, right? So imagine the generator gets stuck on one of the fraud criteria. Let's say it's like really struggling
23:13
and constantly scoring low on originality. um you know uh this kind of GAN style
23:20
harness which we're using will just throw the whole thing out and try again from scratch. Um whereas uh in a single
23:26
pass generation or a Ralph loop um it gets it keeps trying to patch the same
23:32
thing. Uh and this kind of ability to kind of course correct over very long uh kind of time horizons is something which
23:38
is quite unique uh to kind of breaking down the different roles uh that go into to building something.
Introducing the 'Planner' role
23:45
So that was just an insight into I guess how we think about the front end component. Um but how to go from kind of
23:52
like just nice pages to fully working apps. We added uh one more role
23:58
um a planner. And so again sounds very simple. Um it's ultimately just taking
24:04
kind of a oneline prompt um and then breaking it down into uh a very deliberately highle uh kind of spec.
24:12
So what it does is actually just spec the granular um uh sorry it kind of specs
24:20
uh the general workflow into a series of sprints. Um what it doesn't do and and
24:25
what most harnesses do today is necessarily try and plan the granular technical details of of the product. The
24:32
reason being is you know one it's very likely to still make an error but when it does make an error it's going to
24:38
cascade um through every single one of these sprints. uh and kind of magnify errors over a multi multi-our time
24:44
horizon. If you kind of squint uh at this um this is kind of just you know a
24:51
very simple kind of like PM IC and and QA kind of or structure right like we
24:56
didn't invent this um we just kind of gave each role its own kind of context window. Um
The generator-evaluator contract
25:04
and the bit which is kind of interesting I think to talk about is the glue between the generator and the evaluator
25:11
in this kind of setup. So before the generator actually goes ahead and write a single line um we have
25:18
the two agents basically negotiate what done actually means and so let's say the
25:26
generator proposes um I'm going to build X feature um and you should verify it by
25:31
testing Y. um the evaluator might push back and be like actually uh the scope
25:36
is too big and those tests that you propose are a bit too weak uh and you've missed XYZ edge case and you basically
25:43
have this back and forth uh via files on disk. one writes a markdown. Um the other reads it um and you iterate until
25:51
both agree and then once you kind of reach that kind of condition um
25:56
then you actually start building. Uh and then the evaluator kind of grades against the contract um that those two
26:04
agents have decided between themselves, not the original spec which the planner has kind of oneshotted at the beginning.
26:10
And why this matters um as it kind of bridges this kind of idea of kind of
26:16
user stories uh i.e. the spec um and kind of converts it into slightly more
26:21
tangible testable kind of assertions some sort of contract uh without the planner having to oversp specify kind of
26:27
upfront and I think this is kind of the key innovation that the Ralph loop never
26:33
really had. It had a kind of fixed plan MD style uh kind of thing, but nobody uh
26:41
on the other side is necessarily arguing with kind of the main loop. And again, it comes back to like having these
26:47
separate context windows and adversarial pressure. So, let me show you an example of uh a very simple prompt that we had
26:57
um uh in a solo kind of group versus uh the harness that we just discussed. So,
27:03
the prompt was basically build a retro game maker. Um, and and that was it. And I'm not, you know,
27:12
going to going to try and convince you that this is like necessarily the most cost-effective or most efficient way to
27:18
try and build an app. Um, as you can see, one, it takes uh at the moment an
27:23
extremely long amount of time. Um, two, it's very expensive. But also uh as
27:28
we'll see in a second, a lot of the stuff actually starts working only uh with this harness um when it didn't in a
27:34
kind of a solo loop. So this is uh what it kind of looked like the opening
27:40
screen at least when we didn't have the harness. Um pretty simplistic, a little bit boring. Um but it still looks nice,
27:48
right? Um if this were the whole app, uh you'd chip it, but it's kind of the bait, I guess, uh if you will. Um, this
27:55
was kind of the uh sprite editor, if you will. Again, it still looks fine. Um,
28:01
the canvas is there, the pallet, the frame timeline, live preview. Maybe it's a little bit cramped. Um, uh, and the
28:08
color picker is just black swatches, but it it kind of works. Um, clearly the agent like actually did understand what
28:14
it was trying to do. Um and then the one thing that you actually has to do um uh
28:20
which is play mode entities rendered um score, health, all the other things
28:26
which go into an actual game. Pressing an arrow key does nothing. Pressing a space key did nothing. Um the agent
28:33
really didn't have any idea um how to test itself uh uh what it actually meant
28:39
to play a game and and actually succeed. Um, and yeah, this is kind of the same
28:46
prompt, same model. Um, and this is kind of the the breaking point. It kind of
28:51
looks done on the surface, but when you try and actually push it to its limits, it just uh it just kind of failed. And
28:56
then if we ran the same prompt with the same model, this is kind of what it looked like uh when we ran the harness.
29:02
So, this was about yeah, 200 bucks, six hours. Um, first up, it decided to name
29:08
itself um RetroForge. um it decided to like create a new
29:14
project dialogue um have a very nice canvas. Um none of that was in our prompt. So this was all the planner um
29:21
deciding like okay uh here's what the product decisions should look like and then you know the two other agents
29:27
deciding right how am I going to test this? Um if we look at the sprite editor um we
29:34
have kind of a full 54 color palette. um the kind of 8 bit preset from the
29:39
project dialogue flowing through. Um you see the sprite at actual game scale. Um
29:46
it's a lot more complete uh as a product in general. Um we had a whole new kind
29:53
of AI level assistant. This is where it's kind of started to get recursive.
29:58
The planner had decided like right we should have some AI features um which is just a v vague line in the spec. And the
30:05
harness turned that into a full AI level assistant inside the app that it it was building. So, you know, someone could
30:11
come in and say, "Hey, create a castle uh with sprites guide guarding it." Let's say um
30:19
this is something which the solo run would never even attempted to look at. Um without the planet, that phrase just
30:25
becomes never even comes becomes like a work item to look at. Then finally I guess um uh the actual
30:33
results kind of applied. So play mode um you know you have this
30:40
whole debug HUD in the top left um which you can clearly tell is to make life easier for for for the evaluator for
30:46
example. Those numbers are live. The physics loop is actually running. Um
30:51
arrow keys work. The player moves. Um Collider's Castle Wars. um because the
30:58
evaluator actually launched the game, tried to play it, knew necessarily like what what features needed to be tested
31:06
to make this game kind of real and successful. Um and the difference between this output and you know the
31:11
previous output is entirely just scaffolding. It's a very simple loop ultimately, but the results are quite startlingly different at least.
31:19
And so in case you're curious, the kind of things which the evaluator did catch
31:26
um are pretty basic kind of stuff. It's things like um you know fast API route
Specificity in contracts and debugging traces
31:33
ordering um passes every unit test but might actually break in prodal
31:39
um catching things like the delete key um having some kind of boolean logic bug. Um again these are things which
31:46
were only caught because that evaluator is actually using the app. Um it's things which might get through CI in a
31:52
RA loop. Um um but this isn't you know that level of
31:58
specificity isn't something which happened by accident. And so
32:04
this is the kind of level of detail which these models are kind of going to at this point in time. So we talked about the kind of contracts that the
32:11
generator and the evaluator would write between themselves for this app. Um it decided that there were 27 contract
32:17
criteria. That's a level of granularity which we found, you know, that you really need to make findings kind of
32:23
actionable. If you have vague criteria, you have vague critiques. The generator just kind of shrugs and does things.
32:30
Whereas if you have granular criteria, um the agent knows, okay, I need to fix this exact line.
32:40
What's kind of interesting, I thought, you know, uh, and I want to be honest about this part, is that out the box,
32:45
Claude is a really, really bad just general QA agent. Um, Andrew talked
32:50
about this, uh, a little bit, uh, in his bit, right? But the same kind of syphy
32:56
and generosity bias that everyone hits with uh, general elements of judge systems also applies here. Um, most of
33:03
the time in early runs it would, you know, the QA agent would kind of find a bug and be like, uh, fix it later, might
33:09
take two weeks. Um, uh, and then just kind of like be done with it. Um, so we
33:15
actually had to spend an exorbitant amount of time like going through, um, trying to tune, you know, small layout
33:21
bugs, edge cases, and and kind of feeding that into the prompts.
33:26
I wish there was some kind of secret to to actually doing this, but realistically the whole uh kind of art
33:33
to building this system and making it good uh was kind of reading the traces. Um the primary debugging loop was this
33:39
and not necessarily running more experiments. It was reading what the agent actually did um finding where its
33:45
judgment diverged from um ours as humans and then tuning the prompt for that.
33:50
It was the same kind of muscle as reading kind of a stack trace. Um um one kind of tooling tip that we
33:58
had was kind of piping agent transcripts uh into files uh kind of gpping them uh
34:03
with another agent or having another agent kind of go through them um and then kind of update the prompts itself
34:08
so you have some sort of like closing the loop even on just like building uh this harness out.
Adjusting harnesses as models evolve
34:14
So the last thing I kind of wanted to talk about was um how to think about
34:20
adjusting your harness as these models kind of get better in time. I think there's a lot of like discussion around
34:26
whether h design is kind of dead or null especially with you know models that I
34:31
mean when I wrote this it was just open 4.6 text, but even like mythos, you know, level level models. And
34:38
I think the key thing that we note noted is it's really important to get a feel for what the kind of spiky behaviors of
34:46
any individual model are and then try and adapt your harness to kind of fill fill the gaps. So,
34:52
um, Andrew talked about this a bit, but you know, context resetting between sessions, we kind of dropped that
34:58
entirely. Opus 4.5 used to have really bad kind of context anxiety. um whereas
35:03
Opus 4.6 just you know didn't um uh as part of a part of post training there
35:09
and so one continuous session in compaction was was more than more than enough to handle very long sessions.
35:15
Sprint decomposition um we don't have a very strong opinion on this but it was something which was really really
35:21
critical to getting Opus 4.5 to work. Um but uh Opus 4.6 was able to kind of hold
35:28
a two-hour continuous build coherently. uh in a way without necessarily having to be forcefed one feature at a time. Um
35:36
the cadence at which the evaluator should run. Previously we are running at every single sprint per se whereas now
35:43
we were just running at at the end of a oneshot generation from the model and then passing back. So the harness is
35:49
still the same. We're just kind of simplifying the specific uh kind of loops um and kind of the recipe that
35:55
kind of goes into it. The lesson isn't necessarily our harness was wrong, but rather it was right for 4.5, the
36:02
frontier moved. Um, and we ran a simplified version uh to see how it'd work.
36:08
So, this is kind of what the final kind of setup kind of looks like today. um
36:14
having that planner generator evaluator loop is still the kind of core of our system. But you can see we kind of
36:20
ditched a bunch of the other kind of um kind of components uh that made this
36:26
slightly more compl complicated than it had to be. Um we also as kind of mentioned big fan of just using a file
36:32
system for shared state um uh instead of kind of leaning on context windows uh for very long running agents in general.
36:39
And this is an example uh of the simplified harness running um with one
36:45
of our latest models um again very very expensive but you can see it's actually
36:51
roughly like half the cost of the previous runs um just because uh uh
36:58
we're kind of doing things in a slightly more simplified manner but it's still running over a very extended period of time
37:04
and so this is an example of a DAW which is basically just like a music creating
37:10
app, if you will. Um, the agent sets the tempo, a key, it lays down the melody,
37:16
it builds the drum tracks. This is the evaluator um, actually going and uh, testing the
37:24
app itself. Um, we did actually listen to like the music in this. Um, obviously
37:31
Claude can't hear at the moment and so the music was pretty trash but the app
37:37
was really good uh in general and pretty pretty fleshed out which you know a model ago this is something which would
37:43
never have worked. Um, but this is something which was possible with just a couple rounds. Um, and this is kind of
37:49
that that meter curve which Andrea was talking about uh kind of really in in action.
37:55
And so I kind of wanted to close just by saying you don't necessarily need you know our
How to build your own agent harness
38:00
internal harness to to go away and start thinking about this. We are constantly trying to ship bits of you know these
38:07
primitives into cord code directly but also there's nothing stopping you from just going ahead and building something
38:12
similar to this uh kind of on your own. So, we just shipped, you know, auto mode is probably my favorite thing. Um, for
38:18
slightly more, you know, safe safe yellow, if you will, um, instead of running dangerously skip permissions all
38:24
the time. Um, we already have custom sub agents as a primitive, right? Your evaluator, your QA role, um, give it a
38:31
harsh system prompt and a very detailed rubric. um Playright MTP or CL for Chrome MTP already extremely extremely
38:38
good uh at um web app stuff or just use computer
38:43
use if you're building kind of native apps. Um and skills again a very nice way to package your kind of grading
38:49
rubrics into your kind of general development flow. Um so yeah, five things if you're kind of
38:56
taking a photo this is the the slide I would say to to to kind of remember. Um, self-evaluation very much a trap. Just
Key takeaways for long-running agents
39:03
use an adversarial evaluator. Um, compaction doesn't necessarily uh does
39:09
not equal kind of coherence, right? Lossy summaries really drift. Um, structured handoffs uh and clean context
39:16
are a very good pattern that we've seen. Um, don't think that sub subjective quality isn't gradable. If you have a
39:23
strong view on what something should look like, um, then kind of force yourself to write it down. Um we found
39:29
this made kind of a really massive difference uh to the quality of kind of apps um that a model was able to
39:34
generate. And then kind of finally was really just you know sit with the model, read the traces. Um uh only then can you
39:42
kind of really know what bits uh of a scaffold to delete um what bits to keep
39:47
especially as a kind of frontier uh moves. But yeah, that's it from me. Um
39:54
thank you very much for listening. Um,
40:01
and yeah, check out our blog post. Um, but wanted to just open up for Q&A in general because we've been yapping for
Q&A session
40:07
like close to an hour now. So, um, if you have any questions for me and Andrew, just fire away. We'll do our
40:13
best to to try and answer them. Yeah,
40:19
thank you. Joan from Psideide. Uh, one question for you. when you improve the
40:25
evaluator by like reading the logs and improving it is that uh sort of like on a per project basis or more of a secret
40:32
source that you reuse across project the goal the goal was very much to try and do this in a way which was reusable
40:40
right like I think anyone can tune this in a way that's that's creating you know a very specific type of app that's fine
40:46
at that point it's not that different from you know going ahead and just prompting call code yourself and doing it right I think there were just the the
40:52
key was like what are the common patterns uh that you can kind of draw across the model weak points right so
40:59
talking to that kind of front end design piece we knew like what we thought good design would be right you could give
41:04
examples like this is what you know um a really beautiful product looks like this
41:10
is what AI slop looks like right um and that generalizes quite well so yeah this was all around web apps but it could
41:16
quite easily apply to to other kind of things as
41:24
Thanks for test. Yeah. Uh thank you for
41:32
presentation very interesting. Uh I was just wondering what is your view on um
41:37
uh concept of dump zone and smart zone of a model. So I understand like before
41:43
it was around 40%, now with 1 million context it's about 100k is what I understand and the way how understood
41:50
Ralph loop Ralph loop was designed is to kind of negotiate this problem. So basically we're keeping the model always
41:58
in a smart zone. So basically trying to slice a task below 100 so it ex execute
42:04
the task within 100 contact zone. And what I understand from your presentation, you kind like advocating
42:09
not to use it anymore because we can now rely on a compaction and off and so on. Is it like something
42:16
you suggesting to do or we still like a rough loop model still has its own place
42:22
given the smart and dum uh concept?
42:29
Yeah. Well, I suppose from Ash's presentation um and mine, you see that the 1 million context window is now GA
42:36
and so you have sort of a big bigger context to use. Uh the models are more agentic so they can sort of maintain
42:42
coherence for a longer period of time within that context window and that actually with the release of 4.6 we
42:48
decided to move from new context windows to just a single long running continuous session with compaction. So I think I
42:56
mean the whether or not you use multiple fresh sessions or just one long running
43:02
one is probably still up to your use case and your evals um depending on what you you're seeing is working best but at
43:08
least for sort of this general purpose um generator evaluator pattern with opus
43:13
4.6 we saw that it was possible to use a single session. I don't know if you want to add to that. I I think it's also just like a
43:19
temporary problem, right? Like context rot is, you know, a failing of like
43:25
today's models to some extent. Uh and much less so than, you know, even just one model generation ago. So is there a
43:32
place for for um you know, the type of thing which you're discussing? I think yes uh depending on use case but you
43:39
know it's not like a it's one of those pieces which I would look at as like okay as soon you know I'd be I'd be kind
43:44
of hunting for the model release where I can kind of strip it out let's put it that way.
43:53
I always have a lot of FOMO around playright. I mean you said playwright MCP is playright skills.
44:00
Do you can you speak to how to improve the playright? Because like I imagine I
44:05
would like to like have my browser open and then I can see the model working through it and then maybe I can steer
44:12
it, you know, the few tabs open. But like yeah, what is there some
44:18
innovation there I'm missing out on or is is play MCP really you recommend
44:24
people use? I mean play MCP or just use the CL for Chrome MCP which is like a a slightly more robust thing I guess around browser
44:32
control. I mean, I don't know why you want to watch it do things. I mean, you can, but I think that's like a trust
44:38
gap, right, today. Like, you know, the whole point of what we're trying to get to do here is is like you set something
44:44
off, uh, you trust it to do it do the work and test it and you have the confidence that it's doing it correctly and you come back to it. Um, and that's
44:50
where, you know, yes, there's going to be some iteration at the beginning where you're like watching reading the traces until you get to a point you can trust
44:56
it. But um at least internally right like when I'm when I'm doing full stack
45:01
out dev um I have got to a point now where I'm like okay with Opus 4.6 I can
45:07
like reliably trust the model to go ahead read um network errors um uh uh console
45:16
errors actually navigate up zoom in where it needs to. um the vision is now good enough on these models that I can
45:22
like identify overlapping text on elements and things like that whereas that just wasn't the case uh uh until
45:30
realistically the last you know generation of models. So yeah I would I
45:36
would recommend um
45:45
I'm curious like with the generator evaluator pattern What happens? Do you
45:51
can you throw unlimited tokens at it or will it stop uh because the evaluator is not good enough? Like can you tell me
45:59
more about that? Sorry, do you mind clarifying? I kind of messed up. Yeah. So, okay, let's say um I say okay,
46:06
create like a very cool game um with some features.
46:12
If the generator evaluator pattern that uh creates like contracts, builds the
46:18
apps. If I um then it will give me back something
46:24
right. Um can I restart it again and say like okay uh make it better I'm not
46:31
happy about it and generate the evaluator will pick the pattern will pick it up and make it better.
46:37
Yeah. Or will the evaluator be not good at one point and just say like this is it.
46:44
Um I think that's I mean one first of all like if you want like some some level of human in the loop in this
46:50
process that's that's like you know just implement hooks at some point some point in this in this loop. Um I think the bit
46:57
which was kind of surprising to us um uh was
47:02
with this this general pattern and especially with the kind of 4.6 six liner models, both Sonnet and Opus, it
47:08
was extremely willing to like throw away everything, you know, even if it had done kind of 10 passes at something,
47:14
it was kind of very happy to just like throw it all away and start from scratch if for some reason it wasn't able to
47:20
like hill climb against the rubric of the evaluator in a kind of effective way. Um, and so
47:27
that's why kind of when we're kind of when we were playing with this kind of thing, we didn't naturally like lean
47:32
towards having um some kind of resume or human in the loop uh type intervention
47:39
system I guess and we didn't really observe we expected to but we didn't really observe um that kind of behavior
47:46
which you're talking about where it kind of just like evaluators like ah just give up let's just like pass it on shall
47:51
we say. Um, yeah, it was just much more willing to like throw away everything
47:56
and and restart and that was just a behavior which we never saw when it was the generator itself almost kind of
48:01
being part of its own work and being like I'm not going to restart this whole thing. Um, so yeah, I mean there there's
48:08
been examples which I've seen where the evaluator is like it kind of gets fed up and it's like right this approach you're
48:13
taking just obviously isn't working. Can you just like delete everything and restart? Um, which I don't know about
48:19
you guys, but vibe coding regularly I often I often do uh uh as a human to like you know just benefit from fresh
48:25
context windows, not have to deal with an already messy code base etc. So it's quite neat seeing models now also kind
48:32
of uh get to that point. I'd also just briefly add obviously you
48:37
can then open that codebase in cloud code and continue where you left off. um sort of goes without saying and I think
48:44
we're generally thinking about what the workflow looks like if it's sort of more back and forth um because there's sort
48:50
of the extreme of build me a really complex gaming application that you don't know is it going to take three
48:55
hours is it going to take 20 hours um it's a bit unclear so maybe there's sort of something in the middle that's like
49:00
more of a yeah feedback loop
49:06
hi um I really like the idea that you have of like you know there's a
49:12
there's a human element here where it's like you know uh PM engineer evaluator
49:17
um PM role is a lot of the time it's like scope creep and keeping the time going and stuff like that but you're
49:24
just like letting this off you're letting engineers go play in the sandbox for ages. Um is there a harness loop
49:31
that needs to go back to the planner eventually? Does it need to move again? Um well maybe because we're engineers we
49:38
just decided like ah screw the we'll just stuff it to the side. you guys.
49:44
We actually well this is where the kind of like that kind of contracting piece uh between the the
49:51
kind of uh evaluator and the builder worked quite well for context in that we
49:57
typically like insert the main spec that was generated by like the PM per se uh
50:03
into those sessions regularly so that you know it's always a reference point um for like okay this is what we're
50:09
still actually trying to build and the main function of then the builder and the generator uh sorry the builder and the evaluator is just to like figure out
50:16
the exact feature set and tests and contracts per se that actually satisfy
50:22
that spec. Um, but the reason we don't is because we don't want the planner to
50:30
be like a core part of this loop. It should be very high level. It should its purpose really is just kind of
50:37
set out like kind of the hard outer lines of what this product could could be. Uh but it job is not necessarily to
50:43
come in and intervene and be like actually this is like an impossible feature. We should not do this and and and edit itself. Um we kind of wanted to
50:53
keep that context relationship between just uh just the build and the generator. That being said like this
50:58
loop I've applied it in lots of different ways. It doesn't have to just be you know one generator and one builder, right? Like that adversarial
51:05
kind of trade-off can be applied to like a workflow consisting of multiple separate agents, right? Um I don't know
51:12
it could uh if you're trying to do I don't know generate evals let's say you could use a similar harness would be
51:18
like hey generate a uh it could be like planner generate a synthetic a generator
51:25
for synthetic data set right uh with a QA agent then hand off to uh like an
51:30
integrator which like actually wires up something also has a QA agent then has like a final kind of a you can basically
51:36
add this kind of generator evaluator thing into a multi-step workflow flow. Uh we each like builder maybe has like a
51:43
slightly different function per se as part of a longer workflow. So there are different ways in which you
51:48
kind of keep things on track depending on the task and break down uh this this general pattern into slightly more
51:55
specified you know uh tasks or workflows if that makes sense.
52:02
Can you uh you mentioned that uh some of the later tasks could not possibly be
52:08
done by an earlier model. Can you talk a little bit about your process comparing the tasks on the different models? Like
52:15
do you fire off the same task on Opus 4.6 Opus 4.5 Sonet or is this sort of
52:22
artistal uh co-evolving uh harness model
52:27
um setup obiating that? Yeah, I mean I suppose we walk through
52:34
the history a little bit and if you look at say the first blog post on long run running agents versus the more recent
52:39
one um there's some pretty significant differences there. you know, one being what we were just discussing that the
52:45
initializer agent would build this super comprehensive spec of say 200 different features. Um, and then um in then the
52:54
loop would have to actually go and execute against every single one of those features which may lead to say incorrect design decisions but is sort
53:01
of forced into that behavior. Whereas I think now you're able to have sort of a
53:07
more generic creative direction set with say Opus 4.6 basics and then just having this this loop of the generator
53:13
evaluator. But it does yeah your model selection does inform your harness
53:19
design very much so um of course in a perfect world you could just sort of throw everything at say opus 4.6 but if
53:26
you have cost concerns for example maybe you do use opus 4.6 for planning and then sonnet 4.6 for for the coding or
53:33
the execution that's something that we we tend to see quite frequently. Um, but again, if you're building specific sub
53:39
agents for each of these, you probably want to have some evaluations to be able to understand for that model and that
53:45
prompt how it's performing against that task and then just optimize.
53:52
Do you have any advice on moving beyond sort of these oneshot applications to long live products where we're looking
53:59
to make changes days, weeks later? what sort of artifacts you need to persist to future instances to be able to know what
54:05
has come before what can I change what should I change yeah it's something which we're working on um like right now like we use like
54:13
similar patterns for just a bunch of random stuff internally shall we say and so at the moment it's like set this
54:18
thing off it's running you know um on a remote server somewhere um and I'll just
54:24
come back and check it like after this talk let's say and then I kind of iterate on it kind of manually uh import
54:30
code directly correctly like polish any rough edges, that kind of thing. I think
54:36
in terms of the way that you're actually like setting up this harness, just having um this is why we kind of uh
54:43
default to kind of using a file system estate uh for this kind of loop one because it's just very easy for another
54:48
model to come up and and grip through and and pick up what what's been going.
54:54
But one thing which I like to do is kind of embed little bits of prompting uh throughout this kind of loop which
55:00
basically tells it to write kind of learnings and state to uh some kind of
55:05
uh JSON file because a model doesn't kind of overwrite that too much. Um and so the nice thing uh about that is
55:13
you're basically just leaving like breadcrumbs for another model to come and pick up. So honestly the the key thing for me is
55:19
like how do I instruct this this harness to leave crumbs for a human to come in
55:24
and then use cloud code on top of. So generally it's like hey uh the shape of
55:30
that file might be like uh tried this evaluator found this bug uh implemented
55:36
this fix this fix worked yes tick and then continue and you have kind of like a timestamped uh kind of time log if you
55:44
will of like everything the model has tried the fix it's made and the final state. Um and then also uh having some
55:51
sort of live updating kind of set of docs if you will just very high level
55:56
here's the file structure and then those two files to be honest are more than enough for claw code and a human to come
56:02
in and start iterating on the app with but that's all we're doing at the moment. Mhm.
56:13
Perfect. Um, so it's very interesting to hear the or yeah, first of all, congrats
56:19
on the presentation. Um, and then I was wondering there are kind of two approaches like you have the
56:25
agent team where multiple agents interact with each other and then the
56:30
explicit generator critic setup. Whatever Because in sense like the agent
56:38
team has the same setup where the main agent instructs someone and then can act
56:44
as a critic for the sub agent. But what are the current failure modes that
56:50
causes us to still need the specific generator critic harness instead of just
56:56
the agent team itself? And then what's your estimate of how many model
57:01
generations we would need to just completely rely on the agent team.
57:10
Maybe I mean I can I can sort of address the first aspect of that. So I mean one
57:16
of the limitation of firstly claude code is is using the same harness that that is the agent SDK. So you can technically
57:23
you should be able to build this type of pattern into cloud code. Um, agent teams is a useful framework for potentially
57:31
doing that because you could say have the the generator and the evaluator sort of intercommunicating or maybe it's the
57:38
generator as sort of the main agent and and the evaluator is say a member of of
57:43
the agent team. Um, but I think it's it's sort of evolved more so from that
57:48
first blog post that I shared. I think that was like the the result of that to some extent to try and make that more
57:54
generally available. Um, but one of the things you're limited by obviously is like clawed code would just have to run
58:00
on your machine. I think with the agent SDK, you can also just run it in more of a cloud environment and a sandboxed
58:06
environment for long periods of time and um without it it failing um or you
58:12
having to run like caffeinate on your machine. Um, but I think yeah, cloud code is a good testing ground for
58:18
building out any of these types of harnesses to experiment and explore and see what works before maybe you build it
58:24
into the agent SDK and then actually deploy it as its own application. Um, and yeah, I mean again I would just
58:31
experiment, see if agent teams is something that makes sense for you or if maybe just using regular sub aents or
58:37
some other framing of it, it works better. But yeah, people are using agent
58:42
teams like a ton. I I don't know if you Yeah. Well, well, this is the thing is I don't think we have like a super
58:47
strongly opinioned viewpoint on like um what is the best at any you know set up
58:54
at any given moment in time. It's why Boris always like updates his tweets like this is what I'm doing now. Um like
59:00
agent teams was something which a bunch of people loved internally um and so we
59:05
were like okay let's ship it let's see what people think about it in the field. Um I'm not saying we will but it you
59:10
know we regularly on ship things as well. Um and I do see the generator evaluator
59:15
kind of pattern as like a subset of that like team's approach to thinking about sub agent design. Um not necessarily
59:22
like contradictory to it per se. You know you can imagine like you know classic way in which teams breaks down
59:28
is like you know front end back end um some sort of integrator between them like sub agents. Each of those probably
59:33
deserve their own kind of critic um uh kind of agent pairing with them for
59:39
example. Um, so you can kind of see how the two concepts like overlap. Um, just the general idea behind this is, you
59:46
know, most people when they're running cloud code at the moment their goal isn't to like oneshot an app over like
59:52
six hours and so that isn't necessary to primitive which we like by default like ship uh there. Um so yeah
1:00:05
one thing I was wondering have you also tried like a critic that gets the context of the generator then you I feel
1:00:14
like if it has some clue about the traces of the agent or like the executor.
1:00:19
Yeah. Is that currently the case and the the critic? Uh we we use like a handoff pan. I I
1:00:25
would be very hesitant of that. We did try this, but this is the whole like muddying of of like thoughts between the
1:00:32
two two model streams. I think it's actually much more effective to just let it judge the output um and just provide
1:00:39
instead of being like, hey, you made a misstep when building this by doing X and that's what's resulting in this
1:00:44
issue. It's much more effective to just have the value to be like this is an issue and then let the generator purely
1:00:50
reflect on its own work and then try and figure out how to fix that issue. Um otherwise, you kind of just see We found
1:00:56
that it's very easy for the model to like kill itself that something is working or not and that feed into the
1:01:01
evaluator as well. Last note on that. I think it would then
1:01:07
be interesting if you for the training team if you could train like the the
1:01:13
generator to predict what a critic currently said. Yeah. To to have it be more honest about what
1:01:18
it did and stuff. Maybe we'll welcome that.
1:01:25
Um I want to ask more about traceability like I use u superpowers or like my own
1:01:31
prompts to generate like multiple subentions to implement my let's say my
1:01:37
software or app but what happens is like I don't really know I want to go back
1:01:42
and see where it actually went wrong even but then I'm not able to figure out how to find those traces. How what do
1:01:49
you use for traceability is my question. When you have so many like five six agents running in background like um
1:01:56
yeah um to be honest a lot of it is just reading through traces by hand. Um
1:02:03
we do a lot of that I would say anthropic in general just like reading through traces by hand. Um, we also just
1:02:10
like have, you know, hacked together various things where we, you know, point Claude at uh a bunch of traces um uh
1:02:18
with some custom prompts uh to try and identify like issues with the loop like this is where it veered off and whatnot.
1:02:25
Um we kind of use that as like a first pass I would say maybe to just kind of like see where something where where
1:02:31
like where something might have gone wrong. But to be honest, by far in a way the the the best approach at least that
1:02:37
we use internally is just just reading reading the traces by hand. Um only then do you kind of like truly get to kind of
1:02:43
relate to what the model is trying to actually do. Um yeah,
1:02:51
thanks for the talk. Um I have a few questions. Uh first of all, how do you measure the quality of a harness agent
1:02:58
pair? is it it feels like a vibe check like it's a green field. Uh let's build
1:03:04
an app. Um but let's say you're you're going into a new project maybe brownfield. Um
1:03:12
it feels like a vibe check or some kind of art. Can you make it more scientific or is that just not feasible?
1:03:19
I mean the way that we've thought about it at least, right, is like we specify the rubrics in kind of extreme detail at
1:03:25
the kind of generator and and evaluator level, right? So we talked about for example those four kind of criteria
1:03:31
that's very high level the rubric which we use for like design taste let's say and so we set those up for various bits
1:03:38
of this app right so that can be just for the design element maybe another piece for like how we think about um
1:03:44
kind of API design let's say um um code quality whatever and we kind of use
1:03:51
those as the uh kind of various set of rubrics which
1:03:56
are hill climbing against right and and the evaluator's jobs that you know encourage the builder to hill climb
1:04:01
against those. And so for any given app or output, we have like a signal of this
1:04:06
is where the model started on those those kind of criteria and this is where we've kind of ended at. Now that's less
1:04:13
useful for like kind of like you said working on um kind of newer code bases, but it still applies, right? Like you
1:04:20
could point you just have to start the loop in a different way. um you would just point the evaluator at a given codebase um and be like this is where we
1:04:28
are now and then uh uh give it the the spec of what you're trying to achieve and then let the loop kind of iterate
1:04:34
against those kind of criteria. So like a necessarily a one set of eval. It's
1:04:39
kind of like here are the criteria for what we think good looks like. Then letting the uh evaluator and the
1:04:46
generator come up with a set of kind of tests uh or contracts that need to satisfy and then letting it just as a
1:04:52
harness hill climb against those. Um that's not super comparable across different products and runs. Um but it's
1:04:59
it's very useful for for yeah within a product or run. Also this um this
1:05:04
particular pattern is great for green field like you said but it's quite opinionated. You know it might be using
1:05:10
react like postgress as a database and node on the back end but your brownfield app might be using something totally
1:05:16
different or the rubric that we've created for what we think you know good sort of design patterns are would might
1:05:22
be totally different in your project. So I think that's why we're proposing this as more of a pattern that you would then
1:05:27
um tailor towards you know your application. One follow question
1:05:34
work. Yeah. Um do you use uh do you like direct the
1:05:39
harness individually and how do you cooperate as a team on that? I find it's very hard to like uh when I share my
1:05:46
screen and I'm working conversationally, it's very hard for people to keep up and the other way around I find it
1:05:52
cumbersome to dictate what to prompt. Uh how do you cooperate as a team? Do you
1:05:58
have like team owned harnesses? Um,
1:06:04
is it maybe a good feature for cloth code? Um,
1:06:10
yeah, maybe maybe I I think we we probably do have work to do on that, right? Like I think like um
1:06:17
quite often what happens internally is like you know people come up with these ideas and then they're generally quite bottoms up adopted by different teams
1:06:23
and um it's then the job of the kind of original you know uh idea holders should
1:06:29
we say which was Priy in this case to kind of maintain it and make it kind of composable and generalizable for
1:06:34
different teams and different teams will adapt it and and you know uh make it useful for like their section of the
1:06:40
codebase let's say um but we don't have any good things in that sense. I think like
1:06:45
you know even just observability like some of the people talked about right is like a um generally speaking a thing
1:06:52
which is not fully solved yet for these like ultra longunning uh agents and yeah
1:06:58
interesting area of kind of green field software to explore. Yeah that is that is an interesting one
1:07:04
whether it should be sort of a collaborative experience in in cloud code or even cloud.ai AI I think in just
1:07:11
leveraging software engineering best practices with version control and make your commits and pull requests or if
1:07:16
you're working on your own using something like git work trees so that you're not overwriting the the file
1:07:21
system on multiple different features all makes sense but yeah I think when it comes to collaboration maybe it's
1:07:27
something that you know doesn't happen quite as much because people just build these projects as Ash said from the
1:07:33
ground up and then sort of you know present them to the rest of the
1:07:40
Um, hi uh Jose from Mercedes-Benz research and development here. Hi,
1:07:45
thanks for the talk. Um, while looking at it, I thought okay, it looks a lot like a scrum team, a feature team
1:07:52
working for longer times uh on a a product and I was thinking um how does
1:08:00
human in the loop look like in that scenario? Um because you have you had
1:08:06
this kind of sprints. Uh have you thought about a sprint review kind of
1:08:12
moment where where you as a human get asked, oh hey, here's what we built the last two hours.
1:08:17
Yeah. What's it looking like for you? Yeah. Should we subject our agent to the same trauma that like engineers go
1:08:24
through um of of scrum review? Uh
1:08:29
I mean like the whole point of this general the general idea which behind this talk and also what we're trying to do is like trying to be as like AGI pled
1:08:36
as possible right like how do we build harnesses where we don't need a human in the loop right like what does that look
1:08:41
like are we using this today for everything obviously not right um uh but the goal is you know this is this is a
1:08:48
technique or a pattern which should extend very nicely such that you don't have a human a loop for most things if
1:08:53
you did right it's like uh you know hooks is probably the main primitive to just basically inject uh given some
1:09:01
sort of specific type of stop condition let's say with an evaluator um to basically like hand back to human allow
1:09:08
some kind of developer message input and then continue the loop uh would be like kind of the simple way to implement it
1:09:13
but yeah to be honest we're kind of exploring this from a
1:09:20
what can we do fully autonomously kind of approach as opposed to thinking this as like here's called code and and like
1:09:27
how do we make this like you know more powerful per se. It's very much like a kind of more green field exploration of agent design.
1:09:33
Yeah. No, of course it's just like um if if if I would get the chance to review
1:09:38
it maybe a few hours in and I might be able to steer it in a bit way better
1:09:43
way. Yeah. So that eight hours later it's more like the one kind of project I would like to
1:09:49
have. Yeah. I mean I get what you're saying. I think the question then is is like should that be like a permanent feature
1:09:55
of the harness or is that just like a a thing which you should have like kind of basically prompted around when
1:10:01
building the harness, right? So we would have that, right? We would run this this this harness on loop um and we would
1:10:07
have you know we might spin up like 10 generations of different things and like three of them succeed and seven of them fail in like random ways. And then we
1:10:15
would just sit down with those seven, read through them, uh adjust the prompting of the main harness and then and then try again. and until we get to
1:10:21
a point where we're like quite happy leaving it run uh leaving it to run fully autonomously. So ultimately that's still the end goal for us as opposed to
1:10:27
being like basically giving up on the harness and being like okay we'll just insert a human here to to like cover for any kind
1:10:34
of stability issues. Instead we'd rather embed that and bake that into the harness itself um in the first place.
1:10:46
Have you used this to build anything like sort of like non-green field or I guess like production like anything in
1:10:52
cloud code itself or like have you used it for actual features and and seeing it to the end?
1:11:00
Um I think I mean this does mostly extend to green field projects. I think for brownfield maybe you do need a
1:11:06
little bit more control um as you're starting to build out your own rubrics and and patterns. Um I mean what we're
1:11:14
seeing in brownfield is that if you look at the whole software development life
1:11:19
life cycle it's not just the coding aspects that people are starting to use something like cloud code for it might
1:11:24
be say there's like autonomous monitoring happen happening um and then that could feed into say generating some
1:11:32
kind of like issue or or feature request that could then just feed into um an
1:11:38
agent that would then go through to make the pull request and then there's sort of the pull review um already happening
1:11:44
and then maybe you're just reviewing that before you actually merge. So I think there there are other ways to automate the whole software development
1:11:51
life cycle um uh in a brownfield project. But I think this particular pattern maybe without a lot of testing
1:11:58
within your project and building like customizing it for your project. It's probably more suited towards brand new
1:12:04
applications. Have you built any green field apps that like I don't know like an internal
1:12:10
tooling or or anything like that that you've been using like not just a demo sort of like Yeah. Um to be frank, I can't really
1:12:16
like talk to like Intel tooling too much, but a good anecdote of this was um
1:12:23
like a lot of the the new and fun stuff that you see in C code will will like um
1:12:29
uh when I'm speaking to the team and working with them on stuff use a lot of the lessons from this per
1:12:35
se, like in in like even just general hands-on uh cold code usage, the way that they
1:12:42
prompt, you know, the main uh model to to spin up a sub agent let's say and and and go after something or as kind of
1:12:49
Andrew said right in kind of monitoring and bug fixing loops like you know when generating a fix like should you have a
1:12:55
separate evaluator and a generator go after the same thing so a lot of these principles apply um is it like you know
1:13:00
one for one this maybe not but it's like taking the good bits of this or whatever you think is is kind of applicable to a
1:13:07
certain space and field and then kind of running with it in your own way
1:13:25
Hey, when you say reading the traces, is that literally just like the raw output or is there something more specific
1:13:31
you've prompted it to like write this to file, these are the sorts of things I care about and I want to see? No, you got to read the whole thing.
1:13:37
Read the whole thing. I do think it's like a really important skill when building agents in general is to like
1:13:43
empathize as much with the model. Um this was like there's an interesting uh
1:13:48
anecdote which we used when we were building for example the agent harness for called for chrome um which is our kind of browser use thing. Um,
1:13:57
and we would run this like experiment where like imagine if you know you were trying to navigate a web page and click around where like you know you
1:14:04
effectively doing with your eyes closed and like every 10 seconds you just opened it to see like a static page and then closed it again and then had to
1:14:09
like do things. Um, and like really putting yourself in the shoes of the model um is kind of like this kind of
1:14:17
empathetic skill set which you need to develop. Um, and the only way to really do that is to like spend as much time
1:14:22
with these models, but also, yeah, reading through line by line being like, "Oh, why did it think this? Oh, I can
1:14:28
kind of see why I did that." And then kind of adjusting the way you instruct it next time to to do better. Um, but
1:14:34
that's why I think call for Chrome is very good was just really just like spending a lot of time as a team uh closing our eyes and trying to navigate
1:14:40
web pages for example. So, um, yeah.
1:14:46
Yeah. Yeah. And I think then actually taking those learnings and putting them into say your prom templates or your
1:14:52
cloud MD or building a skill or just generally understanding how to sort of
1:14:58
avoid that type of behavior in the future. I know cloud code now has auto memory for sessions as well. So it's
1:15:03
sort of constantly memorizing little things as it goes. Um but yeah, you can learn quite quickly from reading some
1:15:09
traces like where things might be going wrong. Cool. Should we wrap up there? Um, I
1:15:15
think we have a few minutes left, but we'll be around in general in case you guys want to ask any questions or just chat. But otherwise, thanks for coming
1:15:22
down. Last question of the
