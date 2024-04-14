import React from "react";
import { DateTime } from "luxon";

export default class ImportXMLModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = { filename: "Aucun fichier téléchargé" };
  }

  render() {
    return (
      <div id="importXml" className="importXmlModal">
        <div className="importXmlModal-content">
          <span className="close" onClick={this.onClickCloseBtn}>
            &times;
          </span>
          <h1>Importez votre fichier</h1>
          <div className="inputMessage">
            <p>
              Le fichier doit être conforme à la DTD{" "}
              <a
                href="https://ua-usp.github.io/timetabling/schema"
                target="_blank"
                rel="noopener noreferrer"
              >
                disponible ici
              </a>
            </p>
            <p>
              Vous pouvez spécifier un horizon de temps en ajoutant tout en haut
              de votre fichier un commentaire du type :{" "}
            </p>
            <div className="TimeHorizonExample">
              <p>&lt; !--</p>

              <p>&lt;calendar&gt;</p>
              <p>&lt;startingYear&gt;2021&lt;/startingYear&gt;</p>
              <p>&lt;weeks&gt;1-8,10-13&lt;/weeks&gt;</p>
              <p>&lt;weekDays&gt;1-5&lt;/weekDays&gt;</p>
              <p>&lt;/calendar&gt;</p>
              <p>--&gt;</p>
            </div>
          </div>
          <div className="chooseFile">
            <input
              type="file"
              id="XMLFile"
              name="XMLFile"
              accept="text/xml"
              onChange={this.onChangeInputXML}
            ></input>
            <label htmlFor="XMLFile" className="inputXML">
              Choisir un fichier XML
            </label>
            <p id="fileName">{this.state.filename}</p>

            <button className="option-button" onClick={this.importXML}>
              Afficher le calendrier
            </button>
          </div>
        </div>
      </div>
    );
  }

  onClickCloseBtn = () => {
    let modal = document.getElementById("importXml");
    modal.style.display = "none";
  };

  onChangeInputXML = (e) => {
    this.setState({ filename: e.target.files[0].name });
  };

  importXML = () => {
    this.onClickCloseBtn();
    let XMLFile = document.getElementById("XMLFile").files[0];
    var reader = new FileReader();
    reader.onload = () => {
      this.XMLFetch(reader.result);
    };

    reader.readAsText(XMLFile);
  };

  XMLFetch(xmlText) {
    const xml = new window.DOMParser().parseFromString(xmlText, "text/xml");
    let timeHorizon = this.getTimeHorizon(xml);
    let datedepart = timeHorizon.datedepart; // date d'aujourd'hui si aucune date spécifiée en commentaire du fichier xml
    let toutes_les_salles = [];
    let salles_non_utilisables = [];
    let salles_utilisables = [];
    let salles = [];
    let listofevents = [];
    let tous_les_enseignants = [];
    let enseignants_non_utilisables = [];
    let enseignants_utilisables = [];
    let enseignants = [];
    let event_id = 0;

    //On souhaite creer des objets evenements compatibles à fullcalendar pour chaque session
    xml.querySelectorAll("session").forEach((session) => {
      // On commence à iterer sur les sessions de la partie solution
      let session_class = session["attributes"]["class"].value; //On recupere l'attribut class de la session
      let slotinfos = session.querySelector("startingSlot"); // on recupere la balise startingSlot de la session qui contient les informations concernant la date du cours
      let heure_session = slotinfos["attributes"]["dailySlot"].value; // On recupere l'horaire
      let jour = slotinfos["attributes"]["day"].value; //On recupere le jour
      let semaine = slotinfos["attributes"]["week"].value; // on recupere la semaine
      let salle = session.querySelector("rooms").querySelector("room")[
        "attributes"
      ]["refId"].value; // On recupere la salle
      let enseignant = session
        .querySelector("teachers")
        .querySelector("teacher")["attributes"]["refId"].value; //On recupere l'enseignant

      //On cherche maintenant dans la partie courses (en dehors de la partie solution)

      let courses = xml.querySelector("courses");
      let _class = courses.querySelector('[id="' + session_class + '"]'); //On recupere la balise class dont l'id est egal à l'attribut class de la balise session
      let capacite_accueil = _class["attributes"]["maxHeadCount"].value; //On recupere la capacité d'accueil du cours
      let part = _class.parentNode.parentNode; //On recupere la balise parent de la balise classes elle meme parent de la la balise class

      let categorie = part["attributes"]["label"].value; // On recupere la categorie

      let nb_sessions = part["attributes"]["nrSessions"].value; //On recupere le nombre de sessions de ce cours

      let allowedSlots = part.querySelector("allowedSlots"); //On recupere la balise allowedSlots du cours
      let duree_session = allowedSlots["attributes"]["sessionLength"].value;
      let horraires_dispos =
        allowedSlots.querySelector("dailySlots").textContent;

      let allowedRooms = part.querySelector("allowedRooms"); //On recupere la balise allowedRooms du cours
      let salles_dispos = []; // On recupere toutes les salles disponibles pour le cours
      allowedRooms.querySelectorAll("room").forEach((room) => {
        salles_dispos.push(room["attributes"]["refId"].value);
        salles_utilisables.push(room["attributes"]["refId"].value);
      });

      let allowedTeachers = part.querySelector("allowedTeachers"); //On recupere la balise allowedTeachers du cours
      let enseignants_dispos = []; // On recupere tous les enseignants disponibles pour le cours
      allowedTeachers.querySelectorAll("teacher").forEach((teacher) => {
        enseignants_dispos.push(teacher["attributes"]["refId"].value);
        enseignants_utilisables.push(teacher["attributes"]["refId"].value);
      });

      let course = part.parentNode; // On recupere la balise course parent de la balise part
      let matiere = course["attributes"]["id"].value; // On recupere la matiere

      let dureesession =
        part.querySelector("allowedSlots")["attributes"]["sessionLength"].value; //On recupere la duree de session de l'attribut sessionLength de la balise allowedSlots(deuxieme noeud de part)

      //On cherche maintenant dans la partie classes de la solution

      let groups = xml.querySelector(
        'solution > classes > [refId="' +
          session["attributes"]["class"].value +
          '"] > groups'
      ); //On recupere le groups correspondant a l'attribut class de la session
      let groupes_participants = [];
      groups.querySelectorAll("group").forEach((group) => {
        groupes_participants.push(group["attributes"]["refId"].value);
      });

      //on ajoute les evenements

      let eventDate;
      if (
        timeHorizon.jours_disponibles.length !== 0 &&
        timeHorizon.semaines_disponibles.length !== 0
      ) {
        eventDate = this.getEventDate(
          timeHorizon,
          semaine,
          jour,
          heure_session
        );
      } else {
        //Si pas d'horizon de temps defini, on affiche les evenements depuis la date du jour
        eventDate = timeHorizon.datedepart.minus({ weeks: 1, day: 1 }).plus({
          weeks: semaine,
          day: jour,
          minute: heure_session,
        });
      }

      listofevents.push({
        id: String(event_id++),
        resourceId: salle,
        title: matiere,
        start: eventDate.toString(),
        end: eventDate.plus({ minute: dureesession }).toString(),
        textColor: "black",
        display: "auto",
        extendedProps: {
          categorie: categorie.split(","),
          salle: salle,
          matiere: matiere,
          groupes: groupes_participants,
          enseignant: enseignant,
          capacite_accueil: capacite_accueil,
          nb_sessions: nb_sessions,
          duree_session: duree_session,
          horraires_dispos: horraires_dispos,
          salles_dispos: salles_dispos,
          enseignants_dispos: enseignants_dispos,
        },
      });
    });

    //------------------------------------------------------------------------------------------------------------------------

    let rooms = xml.querySelector("rooms"); // On regarde dans la premiere section : rooms, listant toutes les salles

    //on souhaite recuperer toutes les salles listées dans le fichier

    rooms.querySelectorAll("room").forEach((room) => {
      toutes_les_salles.push(room["attributes"]["id"].value);
    });

    //On souhaite recuperer seulement les salles utilisables
    salles_utilisables = [...new Set(salles_utilisables)];
    salles_utilisables.forEach((salle) => {
      let room = rooms.querySelector("[id='" + salle + "']"); //Pour chaque salle utilisable
      salles.push({
        //On cree un objet representant la salle
        nomsalle: room["attributes"]["id"].value,
        capacite: room["attributes"]["capacity"].value,
        infos: room["attributes"]["label"].value,
      });
    });

    //On souhaite recuperer les salles non utilisables
    toutes_les_salles.forEach((salle) => {
      if (!salles_utilisables.includes(salle)) {
        salles_non_utilisables.push(salle);
      }
    });

    //------------------------------------------------------------------------------------------------------------------------

    //On fait la meme chose pour les enseignants

    let teachers = xml.querySelector("teachers");

    teachers.querySelectorAll("teacher").forEach((teacher) => {
      tous_les_enseignants.push(teacher["attributes"]["id"].value);
    });

    enseignants_utilisables = [...new Set(enseignants_utilisables)];
    enseignants_utilisables.forEach((enseignant) => {
      let teacher = teachers.querySelector("[id='" + enseignant + "']"); //Pour chaque salle utilisable
      enseignants.push({
        //On cree un objet representant la salle
        nom: teacher["attributes"]["id"].value,
        infos: teacher["attributes"]["label"].value,
      });
    });

    tous_les_enseignants.forEach((enseignant) => {
      if (!enseignants_utilisables.includes(enseignant)) {
        enseignants_non_utilisables.push(enseignant);
      }
    });

    //------------------------------------------------------------------------------------------------------------------------

    this.props.CalendarCallback(
      salles,
      salles_non_utilisables,
      salles_utilisables,
      enseignants,
      enseignants_non_utilisables,
      enseignants_utilisables,
      listofevents,
      datedepart.toString(),
      timeHorizon
    );
  }

  getTimeHorizon = (xml) => {
    let annee;
    let semaines_disponibles = [];
    let jours_disponibles = [];

    //On souhaite d'abbord recuperer les semaines disponibles

    var firstnode = xml.childNodes[0]; //On recupere le premier noeud
    if (firstnode.nodeType === 8) {
      //Si le premier noeud est bien un commentaire
      const xmlfirstnode = new window.DOMParser().parseFromString(
        //On recupere le contenu du commentaire et on le traite comme un nouveau fichier xml
        firstnode.data,
        "text/xml"
      );
      let calendar = xmlfirstnode.querySelector("calendar");
      annee = calendar.querySelector("startingYear").textContent;
      calendar
        .querySelector("weeks")
        .textContent.split(",")
        .forEach((plage) => {
          // pour chaque plage de semaines
          let semaines = plage.split("-");
          let sdepart = parseInt(semaines[0]);
          let sfin = parseInt(semaines[1]); //On recupere la semaine de depart et la semaine de fin et on les convertit en entier
          for (let i = sdepart; i <= sfin; i++) {
            //On ajoute chaque semaine de la plage dans le tabeleau
            semaines_disponibles.push(i);
          }
        });
      //On fait la meme chose pour les jours
      calendar
        .querySelector("weekDays")
        .textContent.split(",")
        .forEach((plage) => {
          let jours = plage.split("-");
          let jdepart = parseInt(jours[0]);
          let jfin = parseInt(jours[1]);
          for (let i = jdepart; i <= jfin; i++) {
            jours_disponibles.push(i);
          }
        });
      return {
        datedepart: new DateTime.fromObject({
          weekYear: annee,
          weekNumber: semaines_disponibles[0],
        }),
        semaines_disponibles: semaines_disponibles,
        jours_disponibles: jours_disponibles,
      };
    }

    alert(
      "Aucun horizon de temps n'a été trouvé dans le fichier, les evenements s'afficheront à partir de la date du jour"
    );
    let jsd = new Date();
    jsd.setHours(0, 0, 0, 0);
    var d = new DateTime.fromJSDate(jsd);
    return {
      datedepart: d,
      semaines_disponibles: [],
      jours_disponibles: [],
    };
  };

  getEventDate = (timeHorizon, eventWeek, eventDay, eventMinute) => {
    let eventDate = timeHorizon.datedepart.set({
      weekNumber: timeHorizon.semaines_disponibles[eventWeek - 1],
      weekday: timeHorizon.jours_disponibles[eventDay - 1],
      minute: eventMinute,
    });
    return eventDate;
  };
}
