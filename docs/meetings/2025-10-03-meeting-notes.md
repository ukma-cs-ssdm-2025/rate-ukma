# Notes from Fourth Team Meeting

- [x] Roles confirmed  
- [x] API design and integration responsibilities discussed  
- [x] Next steps planned and pending questions noted  

## Roles

### **Katya — Backend Lead**  
- Writes main API code with annotations.  
- Tasks:  
  - Add mocked API endpoints and responses *(after `api-design` is ready)*.  
- Notes:  
  - Coordinate with Documentation Lead after design is finalized.  

### **Milana — Documentation Lead**  
- Configures autogeneration and GitHub Pages.  
- Tasks:  
  - Set up documentation publishing (consider GitHub Pages or AWS alternative).  
  - Maintain `api-design.md`.  
- Open Question:  
  - *Can we use AWS instead of GitHub Pages?*  

### **Andrii — Quality Lead**  
- Defines quality attributes and writes tests.  
- Tasks:  
  - Draft initial `quality-attributes` list.  
  - Add core test coverage for the backend.  
- Notes:  
  - “Do magic and add some tests 😄”  

### **Nastya — Integration Lead**  
- Integrates all components and manages CI/CD.  
- Tasks:  
  - Configure deployment pipeline (target platform: **AWS**).  
  - Ensure all services integrate smoothly.  

---

## TODO
- Everyone: Test backend boilerplate locally *(within next few days)*.  
- Andrii:  
  - Create detailed tasks for the upcoming week.  
  - Update the **Team Charter** with roles, planning details, and assign to Documentation Lead.  

---

## Questions to Serge
1. Can we use something else instead of GitHub Pages for hosting docs?  
2. Is it necessary to keep all API code in `src/api`, or can we use a different structure?  

---

## Autogen Flow (Draft)
1. Developer makes a commit.  
2. Before commit:  
   - A pre-commit hook runs a script that updates the YAML file.  
3. CI/CD pipeline:  
   - Regenerates YAML file.  
   - Checks if the generated file matches the committed version.  
4. CI/CD improvement idea:  
   - Create initial backlog task to define this flow fully.