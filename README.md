# helpscout-2-freescout - Helpscout Migration to Freescout

# Overview

We have been happy customers of Helpscout for many years, however over the years prices have gone up and so have our staff count. We rate HelpScout very reliably and very happy with the service & reliability. However we felt that the cost-benefit ratio was not there and the product was not innovating at the price point that we wanted.

## Freescout
Freescout is an opensource helpdesk https://github.com/freescout-help-desk/freescout

## Help Desk Migration
One option that we had to migrate our tickets was https://help-desk-migration.com which seems like a viable alternative for small amount of tickets, but a migration cost of many thousands made it financially unfiesible for us.

# Just Enough

I decided to publish this code not because I think its complete, but it did just enough for us to get to where we needed to be. Hopefully this will get you 90% there if you want to put the other 10% in. I would happly welcome PR's from anyone who wants to spend more time making this more robust. This is the fruit from a few days work.

# Considerations
Helpscout uses 64bit numbers (shared) monotonic identifiers. Freescout uses 32bit. This does not seem to be just a limitation of the database but inside the app itself, so we needed to pull a few tricks.

1. Change Thread-ID to 64bit unsigned.
2. Import the data (Actual ticket numbers are prefered over the ticket ID to keep this number lower and deterministic)
3. Create strong referencial integrety forign key between thread and attachments.
4. Reset the autoincrement and thread ids.

Attachments
1. Modify the attachments table with href column as a string
2. The tool will import the URL's
3. You can run a command such as curl such as for each row, for example

`curl "https://d33v4339jhl8k0.cloudfront.net/inline/67887/722a771300b6ac08d613f4f4ab39cdafd1a3f2cf/1234abcd/image.png" --create-dirs -o "4/c/e/image.png"`

You might need to be a bit smarter with the helpscout downloads to include the browser agent to get the files hosted directly by helpscout.

Best of luck with that 10%